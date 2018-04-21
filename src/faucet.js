const express = require('express')
const  router = express.Router()
const config  = require("./config")
const axios = require("axios")

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

router.use((req,res,next)=>{
  if (config.recaptcha) {
    if(!req.body.recaptchaResponse){
      next("RecaptchaRequired")
    }
    axios.post("https://www.google.com/recaptcha/api/siteverify",{
      secret:config.recaptcha.secret,
      response:req.body.recaptchaResponse
    }).then(response=>{
      if(response.data.success){
        next()
      }else{
        next("RecaptchaFailed")
      }
    })
  }else{
    next()
  }
}).post("/random",featureFilter("random"),(req,res,next)=>{
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
  const cp = new CPAPI(config.coin)
  cp.createTx({
    divisible:false,
    sendAmount:chosen.quantity,
    addressIndex:0,
    dest:req.body.dest,
    token:chosen.asset,
    includeUnconfirmedFunds:true,
    password:config.coin.network.password,
    memo:"",
    feePerByte:config.feeSatByte
    
  }).then(hex=>{
    return cp.signTx(hex,config.coin.entropyCipher,config.coin.password,0)
  }).then(result=>{
    res.send(result)
  }).catch((e)=>{
    next(e.message)
  })
  
}).post("/request",featureFilter("request"),(req,res)=>{
  const token = req.body.token
  const sig = req.body.sig
  const dest = req.body.dest
  
}).post("/receiveAndReturn",featureFilter("receiveAndReturn"),(req,res,next)=>{
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
  
})
router.use((err,req,res,next)=>{
  res.status(500).send(err)
})

module.exports = router
