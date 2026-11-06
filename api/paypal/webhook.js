const api=()=>process.env.PAYPAL_ENV==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(){
  const id=process.env.PAYPAL_CLIENT_ID;
  const secret=process.env.PAYPAL_CLIENT_SECRET;
  if(!id||!secret)throw Error("PayPal server credentials are not configured.");
  const response=await fetch(api()+"/v1/oauth2/token",{
    method:"POST",
    headers:{
      Authorization:"Basic "+Buffer.from(id+":"+secret).toString("base64"),
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:"grant_type=client_credentials"
  });
  const data=await response.json();
  if(!response.ok)throw Error("PayPal authentication failed.");
  return data.access_token;
}

async function persistVerifiedEvent(event){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error("Supabase server credentials are not configured.");

  const resource=event.resource||{};
  const amount=resource.amount||{};
  // Store only the fields needed for the payment-event audit trail.
  // Avoid retaining the full PayPal payload or unnecessary customer data.
  const safePayload={
    id:event.id,
    event_type:event.event_type,
    create_time:event.create_time||null,
    resource_type:event.resource_type||null,
    resource:{
      id:resource.id||null,
      status:resource.status||null,
      amount:amount.value?{
        value:String(amount.value),
        currency_code:amount.currency_code||null
      }:null,
      custom_id:resource.custom_id||null,
      invoice_id:resource.invoice_id||null
    }
  };

  const response=await fetch(
    (url.endsWith("/")?url.slice(0,-1):url)+"/rest/v1/paypal_webhook_events?on_conflict=event_id",
    {
      method:"POST",
      headers:{
        apikey:key,
        "Content-Type":"application/json",
        Prefer:"resolution=ignore-duplicates,return=minimal"
      },
      body:JSON.stringify({
        event_id:event.id,
        event_type:event.event_type,
        resource_id:resource.id?String(resource.id):null,
        payment_status:resource.status?String(resource.status):null,
        payload:safePayload
      })
    }
  );
  if(!response.ok){
    const detail=await response.text();
    console.error("Supabase webhook persistence failed",response.status,detail.slice(0,500));
    throw Error("Could not persist the verified PayPal event.");
  }
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const webhook=process.env.PAYPAL_WEBHOOK_ID;
    if(!webhook)return res.status(503).json({error:"PayPal webhook verification is not configured."});

    const accessToken=await getPayPalAccessToken();
    const headers=req.headers||{};
    const event=req.body;
    if(!event||typeof event!=="object"||Array.isArray(event))return res.status(400).json({error:"Invalid webhook event."});

    const verification=await fetch(api()+"/v1/notifications/verify-webhook-signature",{
      method:"POST",
      headers:{
        Authorization:"Bearer "+accessToken,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        auth_algo:headers["paypal-auth-algo"],
        cert_url:headers["paypal-cert-url"],
        transmission_id:headers["paypal-transmission-id"],
        transmission_sig:headers["paypal-transmission-sig"],
        transmission_time:headers["paypal-transmission-time"],
        webhook_id:webhook,
        webhook_event:event
      })
    });
    const result=await verification.json();
    if(!verification.ok||result.verification_status!=="SUCCESS"){
      return res.status(400).json({error:"Webhook signature verification failed."});
    }
    if(typeof event.id!=="string"||!event.id||typeof event.event_type!=="string"||!event.event_type){
      return res.status(400).json({error:"Verified webhook is missing its event ID or type."});
    }

    await persistVerifiedEvent(event);
    return res.status(200).json({received:true,persisted:true});
  }catch(error){
    console.error("PayPal webhook processing failed",error);
    return res.status(500).json({error:"Webhook processing failed. PayPal may retry this event."});
  }
}
