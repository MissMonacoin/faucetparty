const bcLib = require('bitcoinjs-lib')
const axios = require('axios');
const BigNumber = require('bignumber.js');
const coinSelect = require('coinselect')
const bcMsg = require('bitcoinjs-message')
const bip39 = require("@missmonacoin/bip39-eng")
const qs= require("qs")
const errors = require("../errors")
const coinUtil = require("./util")
const zecLib = require("@missmonacoin/bitcoinjs-lib-zcash")
const bchLib = require("@missmonacoin/bitcoincashjs-lib")
const blkLib = require("@missmonacoin/blackcoinjs-lib")
const jp = require('jsonpath')
module.exports=class{
  
  constructor(opt){
    this.coinId = opt.coinId;
    this.coinScreenName = opt.coinScreenName;
    this.unit = opt.unit;
    this.unitEasy = opt.unitEasy;
    this.bip44 = opt.bip44;
    this.bip49 = opt.bip49
    this.apiEndpoints=opt.apiEndpoints
    this.changeApiEndpoint(0)
    this.network = opt.network;
    this.price = opt.price;
    this.dummy=!!opt.dummy
    this.icon = opt.icon;
    this.bip21=opt.bip21;
    this.defaultFeeSatPerByte = opt.defaultFeeSatPerByte;
    this.confirmations=opt.confirmations||6
    this.sound=opt.sound||""
    this.counterpartyEndpoint=opt.counterpartyEndpoint
    this.enableSegwit=opt.enableSegwit
    this.opReturnLength=opt.opReturnLength||40
    this.isAtomicSwapAvailable=!!opt.isAtomicSwapAvailable
    this.libName = opt.lib
    switch(opt.lib){
      case "zec":
        this.lib=zecLib
        break
      case "bch":
        this.lib=bchLib
        break
      case "btg":
        this.lib=bchLib
        break
      case "blk":
        this.lib=blkLib
        break
      default:
        this.lib=bcLib
    }
    
    this.hdPubNode=null;
    this.lastPriceTime=0;
    this.priceCache=0;
    this.changeIndex=-1;
    this.changeBalance=0;
    this.addresses={}
    this.apiIndex =0

    const seed=
        bip39.mnemonicToSeed(
          bip39.entropyToMnemonic(
            coinUtil.decrypt(opt.entropyCipher,opt.password)
          )
        )
    const node = this.lib.HDNode.fromSeedBuffer(seed,this.network)
    this.hdPubNode =  node
      .deriveHardened(44)
      .deriveHardened(this.bip44.coinType)
      .deriveHardened(this.bip44.account).neutered()
  }
  setPubSeedB58(seed){
    if(this.dummy){return}
    this.hdPubNode = this.lib.HDNode.fromBase58(seed,this.network)
  }
  pregenerateAddress(){
    this.getReceiveAddr()
    this.getChangeAddr()
  }
  getAddressProp(propName,address){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/addr/"+address+(propName?"/"+propName:""),
      json:true,
      method:"GET"}).then(res=>{
        return res.data
      })
  }
  getReceiveAddr(limit){
    if(!limit){
      limit=coinUtil.GAP_LIMIT
    }
    const adrss=[]
    for(let i=0;i<=limit;i++){
      adrss.push(this.getAddress(0,i))
    }
    return adrss
  }
  getChangeAddr(limit){
    if(!limit){
      limit=coinUtil.GAP_LIMIT_FOR_CHANGE
    }
    const adrss=[]
    for(let i=0;i<=limit;i++){
      adrss.push(this.getAddress(1,i))
    }
    return adrss
  }
  getIndexFromAddress(addr){
    for(let p in this.addresses){
      if(this.addresses[p]===addr){
        return p.split(",")
      }
    }
    return false
  }
  getReceiveBalance(includeUnconfirmedFunds,fallback){
    return this.getUtxos(this.getReceiveAddr(),includeUnconfirmedFunds,fallback)
  }
  getChangeBalance(includeUnconfirmedFunds,fallback){
    return this.getUtxos(this.getChangeAddr(),includeUnconfirmedFunds,fallback).then(d=>{
      let newestCnf=Infinity
      let newestAddr=""
      const res=d.utxos
      for(let i=0;i<res.length;i++){
        if(res[i].confirmations<newestCnf){
          newestCnf=res[i].confirmations
          newestAddr=res[i].address
        }
      }
      this.changeIndex=newestAddr?
        this.getIndexFromAddress(newestAddr)[1]%coinUtil.GAP_LIMIT_FOR_CHANGE
      :-1
      return {
        balance:d.balance,
        unconfirmed:d.unconfirmed
      }
    })
  }
  
  getWholeBalanceOfThisAccount(){
    if(this.dummy){return Promise.resolve()}
    return Promise.all([this.getReceiveBalance(false),this.getChangeBalance(false,false)]).then(vals=>({
      balance:(new BigNumber(vals[0].balance)).add(vals[1].balance).toNumber(),
      unconfirmed:(new BigNumber(vals[0].unconfirmed)).add(vals[1].unconfirmed).toNumber()
    }))
  }

  fbGet(url,fallback=true,cnt=0){
    return axios({
      url:this.apiEndpoint + url,
      json:true,
      method:"GET"
    }).catch((r)=>{
      if(!fallback){
        throw r
      }
      this.changeApiEndpoint()
      if(cnt>3){
        throw r;
      }
      return this.fbGet(url,true,++cnt)
    })
  }
  
  getUtxos(addressList,includeUnconfirmedFunds=false,fallback=true){
    let promise
    if(typeof(addressList[0])==="string"){//address mode
      promise=this.fbGet("/addrs/"+addressList.join(",")+"/utxo",fallback)
    }else{// manual utxo mode
      promise=Promise.resolve({data:addressList})
    }
    
    return promise.then(res=>{
      const v=res.data
      const utxos=[]
      let bal=new BigNumber(0);
      let unconfirmed=new BigNumber(0);
      for(let i=0;i<v.length;i++){
        bal=bal.add(v[i].amount)
        const u=v[i]
        if(includeUnconfirmedFunds||u.confirmations){
          utxos.push({
            value:(new BigNumber(u.amount)).times(100000000).round().toNumber(),
            txId:u.txid,
            vout:u.vout,
            address:u.address,
            confirmations:u.confirmations
          })
        }else{
          unconfirmed=unconfirmed.add(u.amount)
        }
      }
      return {
        balance:bal.toNumber(),
        utxos,
        unconfirmed:unconfirmed.toNumber()
      }
    })
  }
  
  getAddress(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    
    if(typeof index !=="number"){
      throw new errors.InvalidIndexError()
    }
    const addrKey = (change|0).toString()+","+(index|0).toString()
    if(this.addresses[addrKey]){
      return this.addresses[addrKey]
    }else{
      if(this.enableSegwit==="legacy"){
        return (this.addresses[addrKey]=this.getSegwitLegacyAddress(change,index))
      }
      return (this.addresses[addrKey]=this.hdPubNode.derive(change).derive(index).getAddress())
    }
  }
  getPubKey(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    
    if(typeof index !=="number"){
      throw new errors.InvalidIndexError()
    }
    return this.hdPubNode.derive(change).derive(index).keyPair.getPublicKeyBuffer().toString("hex")
  }
  getSegwitNativeAddress(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    if(typeof index !=="number"){
      index=this.receiveIndex
    }
    const keyPair=this.hdPubNode.derive(change).derive(index).keyPair
    const witnessPubKey = this.lib.script.witnessPubKeyHash.output.encode(this.lib.crypto.hash160(keyPair.getPublicKeyBuffer()))
    
    const address = this.lib.address.fromOutputScript(witnessPubKey,this.network)
    return address
  }
  getSegwitLegacyAddress(change,index){
    if(this.dummy){return}
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    if(typeof index !=="number"){
      index=this.receiveIndex
    }
    const keyPair=this.hdPubNode.derive(change).derive(index).keyPair
    const redeemScript = this.lib.script.witnessPubKeyHash.output.encode(this.lib.crypto.hash160(keyPair.getPublicKeyBuffer()))
    const scriptPubKey = bcLib.script.scriptHash.output.encode(bcLib.crypto.hash160(redeemScript))
    
    const address = this.lib.address.fromOutputScript(scriptPubKey,this.network)
    return address
  }

  getMultisig(pubKeyBufArr,neededSig){
    const redeemScript=this.lib.script.multisig.output.encode(neededSig|0, pubKeyBufArr)
    const scriptPubKey = this.lib.script.scriptHash.output.encode(this.lib.crypto.hash160(redeemScript))
    const address=this.lib.address.fromOutputScript(scriptPubKey,this.network)
    return {
      address,
      scriptPubKey,
      redeemScript
    }
  }
  
  seedToPubB58(privSeed){
    if(this.dummy){return}
    let node;
    if(typeof privSeed ==="string"){
      node = this.lib.HDNode.fromBase58(privSeed,this.network)
    }else{
      node = this.lib.HDNode.fromSeedBuffer(privSeed,this.network)
    }
    if(this.bip44){
      return node
        .deriveHardened(44)
        .deriveHardened(this.bip44.coinType)
        .deriveHardened(this.bip44.account)
        .neutered().toBase58()
    }
    if(this.bip49){
      return node
        .deriveHardened(49)
        .deriveHardened(this.bip49.coinType)
        .deriveHardened(this.bip49.account)
        .neutered().toBase58()
    }
  }
  seedToPrivB58(privSeed){
    if(this.dummy){return}
    let node;
    if(typeof privSeed ==="string"){
      node = this.lib.HDNode.fromBase58(privSeed,this.network)
    }else{
      node = this.lib.HDNode.fromSeedBuffer(privSeed,this.network)
    }
    return node.toBase58()
  }
  getPrice(){
    return new Promise((resolve, reject) => {
      if(!this.price){
        return resolve(0)
      }
      
      if(this.lastPriceTime+1000*60<Date.now()){
        axios({
          method:this.price.method||"get",
          url:this.price.url,
          responseType:this.price.json?"json":"text"
        }).then(res=>{
          let temp = res.data;
          if(this.price.json) {
            temp = jp.query(temp, this.price.jsonPath)
          }
          this.priceCache=temp
          this.lastPriceTime=Date.now()
          resolve(temp)
        }).catch(reject)
      }else{
        resolve(this.priceCache)
      }
    });
  }
  buildTransaction(option){
    if(this.dummy){return null;}
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    return new Promise((resolve, reject) => {
      const targets = option.targets
      const feeRate = option.feeRate

      const txb = new this.lib.TransactionBuilder(this.network)

      let param
      if(option.utxoStr){
        param=JSON.parse(option.utxoStr)
      }else{
        param=this.getReceiveAddr().concat(this.getChangeAddr())
      }
      
      this.getUtxos(param,option.includeUnconfirmedFunds).then(res=>{
        const path=[]
        const { inputs, outputs, fee } = coinSelect(res.utxos, targets, feeRate)
        if (!inputs || !outputs) throw new errors.NoSolutionError()
        inputs.forEach(input => {
          const vin = txb.addInput(input.txId, input.vout)
          txb.inputs[vin].value=input.value
          path.push(this.getIndexFromAddress(input.address))
          
        })
        outputs.forEach(output => {
          if (!output.address) {
            output.address = this.getAddress(1,(this.changeIndex+1)%coinUtil.GAP_LIMIT_FOR_CHANGE)
          }

          txb.addOutput(output.address, output.value)
        })
        
        resolve({txBuilder:txb,balance:res.balance,utxos:inputs,path,fee})
      }).catch(reject)
    })
  }
  signTx(option){
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    const entropyCipher = option.entropyCipher
    const password= option.password
    let txb=option.txBuilder
    const path=option.path
    
    let seed=
        bip39.mnemonicToSeed(
          bip39.entropyToMnemonic(
            coinUtil.decrypt(entropyCipher,password)
          )
        )
    const node = this.lib.HDNode.fromSeedBuffer(seed,this.network)

    if(!txb){
      txb=coinUtil.buildBuilderfromPubKeyTx(this.lib.Transaction.fromHex(option.hash),this.network)

      for(let i=0;i<txb.inputs.length;i++){
        if(this.bip44){
          txb.sign(i,node
                   .deriveHardened(44)
                   .deriveHardened(this.bip44.coinType)
                   .deriveHardened(this.bip44.account)
                   .derive(path[0][0]|0)
                   .derive(path[0][1]|0).keyPair
                  )
        }else if(this.bip49){
          txb.sign(i,node
                   .deriveHardened(49)
                   .deriveHardened(this.bip49.coinType)
                   .deriveHardened(this.bip49.account)
                   .derive(path[0][0]|0)
                   .derive(path[0][1]|0).keyPair
                  )
        }
      }
      return txb.build()
    }
    
    for(let i=0;i<path.length;i++){
      
      let keyPair;
      if(this.bip44){
        keyPair=node.deriveHardened(44)
            .deriveHardened(this.bip44.coinType)
            .deriveHardened(this.bip44.account)
            .derive(path[i][0]|0)
          .derive(path[i][1]|0).keyPair
      }else if(this.bip49){
        keyPair=node.deriveHardened(49)
            .deriveHardened(this.bip49.coinType)
            .deriveHardened(this.bip49.account)
            .derive(path[i][0]|0)
          .derive(path[i][1]|0).keyPair
      }
      
      if(this.enableSegwit){
        const redeemScript = this.lib.script.witnessPubKeyHash.output.encode(this.lib.crypto.hash160(keyPair.getPublicKeyBuffer()))
        txb.sign(i,keyPair,redeemScript,null,txb.inputs[i].value)
      }else if(this.libName==="bch"){
        txb.enableBitcoinCash(true)
        txb.sign(i,keyPair,null,this.lib.Transaction.SIGHASH_ALL | this.lib.Transaction.SIGHASH_BITCOINCASHBIP143,txb.inputs[i].value)
      }else if(this.libName==="btg"){
        txb.enableBitcoinGold(true)
        txb.sign(i,keyPair,null,this.lib.Transaction.SIGHASH_ALL | this.lib.Transaction.SIGHASH_BITCOINCASHBIP143,txb.inputs[i].value)
      }else{
        txb.sign(i,keyPair)
      }
    }
    return txb.build()
    
  }
  signMultisigTx(option){
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    const entropyCipher = option.entropyCipher
    const password= option.password
    let txb=option.txBuilder
    const path=option.path // this is not signTx() one. path=[0,0]
    const mSig=this.getMultisig(option.pubKeyBufArr,option.neededSig)
    let seed=
        bip39.mnemonicToSeed(
          bip39.entropyToMnemonic(
            coinUtil.decrypt(entropyCipher,password)
          )
        )
    const node = this.lib.HDNode.fromSeedBuffer(seed,this.network)

    for(let i=0;i<txb.inputs.length;i++){
      if(this.bip44){
        txb.sign(i,node
                 .deriveHardened(44)
                 .deriveHardened(this.bip44.coinType)
                 .deriveHardened(this.bip44.account)
                 .derive(path[0]|0)
                 .derive(path[1]|0).keyPair,
                 mSig.redeemScript
                )
      }else if(this.bip49){
        txb.sign(i,node
                 .deriveHardened(49)
                 .deriveHardened(this.bip49.coinType)
                 .deriveHardened(this.bip49.account)
                 .derive(path[0]|0)
                 .derive(path[1]|0).keyPair,
                 mSig.redeemScript
                )
      }
    }
    if(option.complete){
      return txb.build()
    }else{
      return txb.buildIncomplete()
    }
  }
  signMessage(m,entropyCipher,password,path){
    if(!this.hdPubNode){throw new errors.HDNodeNotFoundError()}
    const node = this.lib.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(
      bip39.entropyToMnemonic(
        coinUtil.decrypt(entropyCipher,password)
      )
    ),this.network)
    let kp;
    if(this.bip44){
      kp=node.deriveHardened(44)
        .deriveHardened(this.bip44.coinType)
        .deriveHardened(this.bip44.account)
        .derive(path[0]|0)
        .derive(path[1]|0).keyPair
    }else if(this.bip49){
      kp=node.deriveHardened(49)
        .deriveHardened(this.bip49.coinType)
        .deriveHardened(this.bip49.account)
        .derive(path[0]|0)
        .derive(path[1]|0).keyPair
    }
    return bcMsg.sign(m,kp.d.toBuffer(32),kp.compressed,this.network.messagePrefix).toString("base64")
  }
  verifyMessage(m,a,s){
    return bcMsg.verify(m,a,s,this.network.messagePrefix)
  }
  pushTx(hex){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/tx/send",
      data:qs.stringify({rawtx:hex}),
      method:"POST"}).then(res=>{
        return res.data
      })
  }

  getTxs(from,to){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/addrs/txs",
      data:qs.stringify({
        noAsm:1,
        noScriptSig:1,
        noSpent:0,
        from,to,
        addrs:this.getReceiveAddr().concat(this.getChangeAddr()).join(",")
      }),
      method:"POST"}).then(res=>{
        return res.data
      })
  }
  
  getTx(txId){
    if(this.dummy){return Promise.resolve()}
    return axios({
      url:this.apiEndpoint+"/tx/"+txId,
      method:"GET"})
      .then(res=>{
        return res.data
      })
  }
  

  callCP(method,params){
    return axios.post(this.counterpartyEndpoint,{
      params,
      id:0,
      jsonrpc:"2.0",
      method
    }).then(r=>{
      if(r.data.error&&r.data.error.code){
        throw r.data.error.data
      }
      return r.data.result
    })
  }
  callCPLib(method,params){
    return axios.post(this.counterpartyEndpoint,{
      params:{
        method,
        params
      },
      id:0,
      jsonrpc:"2.0",
      method:"proxy_to_counterpartyd"
    }).then(r=>{
      if(r.data.error&&r.data.error.code){
        throw r.data.error.data
      }
      return r.data.result
    })
  }
  sweep(priv,addr,fee){
    const keyPair=this.lib.ECPair.fromWIF(priv,this.network)
    return this.getUtxos([keyPair.getAddress()]).then(r=>{
      const txb = new this.lib.TransactionBuilder(this.network)
      r.utxos.forEach((v,i)=>{
        txb.addInput(v.txId,v.vout)
      })
      txb.addOutput(addr,(new BigNumber(r.balance)).minus(fee).times(100000000).toNumber())
      r.utxos.forEach((v,i)=>{
        if(this.enableSegwit){
          const redeemScript = this.lib.script.witnessPubKeyHash.output.encode(this.lib.crypto.hash160(keyPair.getPublicKeyBuffer()))
          txb.sign(i,keyPair,redeemScript,null,v.value)
        }else if(this.libName==="bch"){
          txb.enableBitcoinCash(true)
          txb.sign(i,keyPair,null,this.lib.Transaction.SIGHASH_ALL | this.lib.Transaction.SIGHASH_BITCOINCASHBIP143,v.value)
        }else if(this.libName==="btg"){
          txb.enableBitcoinGold(true)
          txb.sign(i,keyPair,null,this.lib.Transaction.SIGHASH_ALL | this.lib.Transaction.SIGHASH_BITCOINCASHBIP143,v.value)
        }else{
          txb.sign(i,keyPair)
        }
      })
      
      return this.pushTx(txb.build().toHex())
    })
  }
  getBlocks(){
    return axios({
      url:this.apiEndpoint+"/blocks?limit=3",
      json:true,
      method:"GET"}).then(r=>r.data.blocks)
  }
  changeApiEndpoint(index){
    if (typeof(index)!=="number"){
      index=(this.apiIndex+1)%this.apiEndpoints.length
    }
    this.apiIndex = index
    const a = this.apiEndpoints[index]
    if(a.proxy){
      this.apiEndpoint = coinUtil.proxyUrl(a.url)
    }else{
      this.apiEndpoint = a.url
    }
    if(a.explorer){
      this.explorer = a.explorer
    }
    if(a.socket){
      this.socketEndpoint = a.socket
    }
  }
  getAddrVersion(addr){
    if(this.libName==="zec"){
      return zecLib.address.fromBase58Check(addr).version
    }else{
      return bcLib.address.fromBase58Check(addr).version
      
    }
  }
  isValidAddress(address){
    const ver = this.getAddrVersion(address)
    if(ver===this.network.pubKeyHash||ver===this.network.scriptHash){
      return true
    }
    const b32 = this.network.bech32
    if(b32&&address.substr(0,b32.length)===b32){
      return true
    }
    return false
  }
  
}
