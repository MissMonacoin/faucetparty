const bcLib = require('bitcoinjs-lib')
const zecLib = require("@missmonacoin/bitcoinjs-lib-zcash")
const bip39 = require("@missmonacoin/bip39-eng")
const crypto = require('crypto');
const errors=require("../errors")
const axios=require("axios")

const addressRegExp = /^\w+:(?:\/\/)?(\w{10,255})\??/

const API_PREFIX="api_v1_"

exports.DEFAULT_LABEL_NAME = "Default"


exports.isValidAddress=(addr)=>{
  try{
    bcLib.address.fromBase58Check(addr)
    return true
  }catch(e){
    try {
      zecLib.address.fromBase58Check(addr)
      return true
    } catch (e2) {
      return false
    }
  }
};
exports.getAddrVersion=(addr)=>{
  try{
    return bcLib.address.fromBase58Check(addr).version
  }catch(e){
    try {
      return zecLib.address.fromBase58Check(addr).version
    } catch (e2) {
      return null
    }
  }
};
exports.usdPrice = 0;

exports.encrypt=(plain,password)=>{
  const cipher = crypto.createCipher('aes256', password);
  return cipher.update(plain, 'utf8', 'hex')+cipher.final('hex');
}
exports.decrypt=(cipher,password)=>{
  try{
  const decipher = crypto.createDecipher('aes256', password);
    return decipher.update(cipher, 'hex', 'utf8')+decipher.final('utf8');
  }catch(e){
    throw new errors.PasswordFailureError()
  }
}

exports.makePairsAndEncrypt=(option)=>new Promise((resolve, reject) => {
  let seed;
  let entropy;
  if(option.entropy){
    entropy=option.entropy
    seed=bip39.mnemonicToSeed(bip39.entropyToMnemonic(option.entropy))
  }else if(option.mnemonic){
    entropy=bip39.mnemonicToEntropy(option.mnemonic)
    seed=bip39.mnemonicToSeed(option.mnemonic)
  }else {
    throw new Error("Can't generate entropy")
  }
  if(option.encryptPub){
    resolve({entropy:exports.encrypt(entropy, option.password)})
  }else{
    const ret ={
      entropy:"",
      pubs:{}
    }
    for(let i=0;i<option.makeCur.length;i++){
      let coinId = option.makeCur[i]
      let pub =option.currency.seedToPubB58(seed)
      ret.pubs[coinId]=pub
    }
    
    ret.entropy=exports.encrypt(entropy, option.password);
    resolve(ret)

  }
});


exports.decryptKeys=(option)=>new Promise((resolve, reject) => {
  let seed=
      bip39.mnemonicToSeed(
        bip39.entropyToMnemonic(
          exports.decrypt(option.entropyCipher,option.password)
        )
      )
  
  const ret = {}
  for(let i=0;i<option.makeCur.length;i++){
    let coinId = option.makeCur[i]
    const pub=option.currency.seedToPubB58(seed)
    ret[coinId]=pub
  }
  resolve(ret)
});
  

exports.getBip21=(bip21Urn,address,query,addrUrl=false)=>{
  let queryStr="?"
  if(addrUrl){
    query.address = address
    query.scheme = bip21Urn
    for(let v in query){
      if(query[v]){
        queryStr+=encodeURIComponent(v)+"="+encodeURIComponent(query[v])+"&"
      }
    }
    return "https://monya-wallet.github.io/monya/a/"+queryStr
  }
  
  for(let v in query){
    if(query[v]){
      queryStr+=encodeURIComponent(v)+"="+encodeURIComponent(query[v])+"&"
    }
  }
  return bip21Urn+":"+address+queryStr
};



exports.proxyUrl=url=>{
  console.warn("Proxy is deprecated")
  return url
  
}
exports.shortWait=()=>new Promise(r=>{
  setTimeout(r,140)
})

exports.buildBuilderfromPubKeyTx=(transaction,network)=>{
  let txb = new bcLib.TransactionBuilder(network)
  txb.setVersion(transaction.version)
  txb.setLockTime(transaction.locktime)
  transaction.outs.forEach(function (txOut) {
    txb.addOutput(txOut.script, txOut.value)
  })
  transaction.ins.forEach(function (txIn) {
    txb.addInput(txIn.hash, txIn.index,txIn.sequence,txIn.script)
  })
  return txb
}
