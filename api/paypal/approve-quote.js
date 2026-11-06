import { createHmac, timingSafeEqual } from "node:crypto";
const sign = value => createHmac("sha256", process.env.QUOTE_SIGNING_SECRET).update(value).digest("base64url");
function equal(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&timingSafeEqual(x,y)}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const owner=process.env.OWNER_APPROVAL_CODE,secret=process.env.QUOTE_SIGNING_SECRET;
 if(!owner||owner.length<16||!secret||secret.length<32)return res.status(503).json({error:"Set OWNER_APPROVAL_CODE (16+ characters) and QUOTE_SIGNING_SECRET (32+ characters) in Vercel."});
 if(!equal(req.body?.ownerCode,owner))return res.status(401).json({error:"Owner approval code is incorrect."});
 const q=req.body?.quote||{},amount=Number(q.amount);
 if(typeof q.scope!=="string"||!q.scope.trim()||q.scope.length>4000||!Number.isFinite(amount)||amount<=0||amount>100000||typeof q.delivery!=="string"||q.delivery.length>500||typeof q.terms!=="string"||q.terms.length>1000)return res.status(400).json({error:"Quote details are invalid."});
 const payload={v:1,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+1800,quote:{scope:q.scope.trim(),amount:Number(amount.toFixed(2)),delivery:q.delivery,terms:q.terms,customer:typeof q.customer==="string"?q.customer.slice(0,160):"",email:typeof q.email==="string"?q.email.slice(0,254):""}};
 const encoded=Buffer.from(JSON.stringify(payload)).toString("base64url");
 return res.status(200).json({approvalToken:encoded+"."+sign(encoded),expiresIn:1800});
}