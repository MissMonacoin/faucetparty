const express = require('express')
const  router = express.Router()
const config  = require("./config")
const axios = require("axios")
const cors = require('cors')

const BigNumber = require('bignumber.js');
const CPAPI = require("./crypto/cpApi")

const TOKEN_ISSUE_MAXIMUM = 0x7FFFFFFFFFFFFDFF

const recentTxId={
  
}

function featureFilter(feature){
  return function(req,res,next){
    if(!config.feature[feature]){
      next("DisallowedFeature")
    }else{
      next()
    }
  }
}
const recaptcha=(req,res,next)=>{
  if (config.recaptcha.secret) {
    if(!req.body.recaptchaResponse){
      return next("RecaptchaRequired")
    }
    axios.post("https://www.google.com/recaptcha/api/siteverify",`secret=${config.recaptcha.secret}&response=${req.body.recaptchaResponse}`).then(response=>{
      if(response.data.success){
        next()
      }else{
        next("RecaptchaFailed")
      }
    })
  }else{
    next()
  }
}
router.use(cors())
router.post("/random",recaptcha,featureFilter("random"),(req,res,next)=>{
  const dest = req.body.dest
  const signature = req.body.signature
  const memo = req.body.memo

  const cp = new CPAPI(config.coin)
  const verifyResult = cp.cp.verifyMessage(req.body.recaptchaResponse,dest,signature)
  if(!verifyResult){
    return next("VerificationFailed")
  }
  const col=config.feature.random.assets
  const oddsScoreSum=col.reduce((a,c)=>a+c.oddsScore,0)
  const val=Math.floor(Math.random()*oddsScoreSum)
  let chosen
  for (let i = 0,l=0; i < col.length; i++) {
    l+=col[i].oddsScore
    if(val<l){
      chosen=col[i]
      break;
    }
  }
  (async function(){
    const addrProp = await cp.cp.getAddressProp("",dest)
    if(addrProp.unconfirmedTxApperances||addrProp.txApperances){
      //return next("AddressHasBeenUsed")
    }
    const txHex= await cp.createTx({
      divisible:false,
      sendAmount:chosen.quantity,
      addressIndex:0,
      dest,
      token:chosen.asset,
      includeUnconfirmedFunds:true,
      password:config.coin.network.password,
      memo,
      feePerByte:config.feeSatByte,
      useEnhancedSend:false
      
    })
    const txId = await cp.signTx(txHex,config.coin.entropyCipher,config.coin.password,0)
    res.send({txId:txId,chosen})
  })().catch((e)=>{
    next(e.message)
  })
  
}).post("/request",recaptcha,featureFilter("request"),(req,res)=>{
  const token = req.body.token
  const sig = req.body.sig
  const dest = req.body.dest
  
}).post("/receiveAndReturn",recaptcha,featureFilter("receiveAndReturn"),(req,res,next)=>{
  const txId = req.body.txId
  const token = req.body.token
  const dest=req.body.dest

  if(!txId||!token){
    return next("Parameter is invalid")
  }
  const cp = new CPAPI(config.coin)
  Promise.all([config.coin.getTx(txId),cp.callCP("get_assets_info",{
    assetsList:[token]
  })]).then(result=>{
    const tx = result[0]
    const assetInfo=result[1][0]
    const owner=assetInfo.owner

    // mcap will be 10000 MONA
    const minimum = (new BigNumber(10000)).dividedBy(assetInfo.supply)
    
    let recipientValid=false
    let value;
    tx.vout.forEach(vo=>{
      vo.scriptPubKey.addresses.forEach(a=>{
        if (a===owner) {
          recipientValid=true
          value=new BigNumber(vo.value)
        }
      })
    })
    
    
    let senderValid=false
    tx.vin.forEach(vi=>{
      if (vi.addr===dest) {
        senderValid=true
      }
    })
    if(!senderValid||!recipientValid){
      throw new Error()
    }
    if (value.isLessThan(minimum)) {
      throw new Error()
    }
    return cp.createTx({
      divisible:false,
      sendAmount:1,
      addressIndex:0,
      dest,
      token,
      includeUnconfirmedFunds:true,
      password:config.coin.network.password,
      memo:"",
      feePerByte:config.feeSatByte
      
    })
  }).then(hex=>{
    return cp.signTx(hex,config.coin.entropyCipher,config.coin.password,0)
  }).then(result=>{
    res.send(result)
  }).catch(()=>next("Error"))
}).get("/random/odds",featureFilter("random"),(req,res)=>{
  res.send(config.feature.random.assets)
  
}).get("/address",(req,res)=>{
  res.send((new CPAPI(config.coin)).cp.getAddress(0,0))
  
})
router.use((err,req,res,next)=>{
  res.status(500).send({error:err})
})

module.exports = router
