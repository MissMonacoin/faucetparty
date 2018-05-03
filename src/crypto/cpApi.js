const BigNumber = require('bignumber.js');
const axios = require("axios")

const DEFAULT_REGULAR_DUST=100000
const DEFAULT_MULTISIG_DUST=100000


module.exports=class{
  constructor(cp){
    this.cp=cp
  }
  callCP(m,p){
    return this.cp.callCP(m,p)
  }
  callCPLib(m,p){
    return this.cp.callCPLib(m,p)
  }
  

  createCommand(paramName,param,opt){
    const addressIndex = opt.addressIndex|0
    const includeUnconfirmedFunds = opt.includeUnconfirmedFunds
    const feePerByte=opt.feePerByte|0
    const disable_utxo_locks=!!opt.disableUtxoLocks;
    const extended_tx_info = true
    const cur = this.cp
    return cur.callCPLib("create_"+paramName,Object.assign({
      allow_unconfirmed_inputs:includeUnconfirmedFunds,
      fee_per_kb:feePerByte*1024,
      disable_utxo_locks,
      encoding:"auto",
      extended_tx_info,
      pubkey:[cur.getPubKey(0,addressIndex)],


      regular_dust_size:DEFAULT_REGULAR_DUST,
      multisig_dust_size:DEFAULT_MULTISIG_DUST
    },param))
  }
  createTx(opt){
    const divisible=opt.divisible
    const sendAmount = opt.sendAmount
    const addressIndex = opt.addressIndex|0
    const dest = opt.dest
    const token = opt.token
    const includeUnconfirmedFunds = opt.includeUnconfirmedFunds
    const password=opt.password
    const memo=opt.memo
    const feePerByte = opt.feePerByte || this.cp.defaultFeeSatPerByte
    const doNotSendTx = !!opt.doNotSendTx
    const useEnhancedSend = !!opt.useEnhancedSend
    
    const cur = this.cp
    let hex=""
    let qty=(new BigNumber(sendAmount))
    if(divisible){
      qty=qty.times(100000000)
    }

    return this.createCommand("send",{
      source:cur.getAddress(0,addressIndex),
      destination:dest,
      asset:token,
      quantity:qty.toNumber(),
      memo,
      use_enhanced_send: useEnhancedSend
    },{
      addressIndex,
      includeUnconfirmedFunds,
      feePerByte,
      disableUtxoLocks:true,
      extendedTxInfo:true

    }).then(res=>{
      return res.tx_hex
     
    })
  }
  createIssuance(opt){
    const divisible=opt.divisible
    const amount = opt.amount
    const addressIndex = opt.addressIndex|0
    const token = opt.token
    const includeUnconfirmedFunds = opt.includeUnconfirmedFunds
    const password=opt.password
    const description=opt.description
    const feePerByte = opt.feePerByte || this.defaultFeeSatPerByte
    const transferDest = opt.transferDest
    
    const cur = this.cp
    let hex=""
    let qty=(new BigNumber(amount))
    if(divisible){
      qty=qty.times(100000000)
    }

    return this.createCommand("issuance",{
      source:cur.getAddress(0,addressIndex),
      asset:token,
      quantity:qty.toNumber(),
      description,
      divisible,
      transfer_destination:transferDest||null
    },{
      addressIndex,
      includeUnconfirmedFunds,
      feePerByte,disableUtxoLocks:true,
      extendedTxInfo:true
    }).then(res=>{
      return res.tx_hex
      
    })
  }
  createOrder(opt){
    const addressIndex = opt.addressIndex|0
    const includeUnconfirmedFunds = opt.includeUnconfirmedFunds
    const password=opt.password
    const feePerByte = opt.feePerByte || this.defaultFeeSatPerByte
    const give_quantity=(opt.giveAmt)|0
    const give_asset=opt.giveToken
    const get_quantity=(opt.getAmt)|0
    const get_asset=opt.getToken
    const expiration=opt.expiration||5000// Blocks
    
    const cur = this.cp
    let hex=""

    return this.createCommand("order",{
      source:cur.getAddress(0,addressIndex),
      give_quantity,
      give_asset,
      get_quantity,
      get_asset,
      expiration,
      fee_provided:0,fee_required:0
    },{
      addressIndex,
      includeUnconfirmedFunds,
      feePerByte,disableUtxoLocks:true,
      extendedTxInfo:true,
      
    }).then(res=>{
      return res.tx_hex
      
    })
  }
  createCancel(opt){
    const addressIndex = opt.addressIndex|0
    const includeUnconfirmedFunds = opt.includeUnconfirmedFunds
    const password=opt.password
    const feePerByte = opt.feePerByte || this.defaultFeeSatPerByte
    const offer_hash=opt.txid
    
    const cur = this.cp
    let hex=""

    return this.createCommand("order",{
      source:cur.getAddress(0,addressIndex),
      offer_hash
    },{
      addressIndex,
      includeUnconfirmedFunds,
      feePerByte,disableUtxoLocks:true,
      extendedTxInfo:true
    }).then(res=>{
      return res.tx_hex
      
    })
  }
  signTx(hex,entropyCipher,password,addressIndex){
    const signedTx=this.cp.signTx({
      hash:hex,
      password:password,
      path:[[0,addressIndex]],
      entropyCipher:entropyCipher
    })
    return this.cp.callCP("broadcast_tx",{signed_tx_hex:signedTx.toHex()})
  }
}





