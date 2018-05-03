const Currency = require("./crypto/currency")
module.exports = {
  coin:new Currency({ // compatible with Monya Coin Parameter Format
    coinScreenName:"Monacoin",
    coinId:"mona",
    unit:"MONA",
    unitEasy:"Mona",
    bip44:{
      coinType:22,
      account:0
    },
    bip21:"monacoin",
    defaultFeeSatPerByte:150,
    apiEndpoints:[
      {
        url:"https://mona.monya.ga/insight-api-monacoin",
        explorer:"https://mona.monya.ga/insight"
      },
      {
        url:"https://mona.insight.monaco-ex.org/insight-api-monacoin",
        explorer:"https://mona.insight.monaco-ex.org/insight"
      }
    ],
    explorer:"https://mona.insight.monaco-ex.org/insight",
    network:{
      messagePrefix: '\x19Monacoin Signed Message:\n',
      bip32: {
        public: 0x0488b21e,
        
        private: 0x0488ade4
      },
      pubKeyHash: 50,
      scriptHash: 55,
      wif: 178,//new wif
      bech32:"mona"
    },
    enableSegwit:false,
    price:{
      url:"https://public.bitbank.cc/mona_jpy/ticker",
      json:true,
      jsonPath:'$.data.last',
      fiat:"jpy"
    },
    confirmations:6,
    counterpartyEndpoint:"https://wallet.monaparty.me/_api",
    opReturnLength:83,
    isAtomicSwapAvailable:true,


    entropyCipher:process.env.FP_ENTROPY,
    password:process.env.FP_PASSWORD
  }),
  recaptcha:{
    secret:process.env.FP_RECAPTCHA_SECRET
  },
 
  feeSatByte:101,
  feature:{// set false if disabled these features
    random:{
      assets:[{
        quantity:1e8,
        asset:"MONA",
        oddsScore:1
      },{
        quantity:3e8,
        asset:"XMP",
        oddsScore:10
      },{
        quantity:1e6,
        asset:"MONA",
        oddsScore:3
      },{
        quantity:5e7,
        asset:"XMP",
        oddsScore:100
      },{
        quantity:1,
        asset:"MISSMONACOIN.THANKYOU",
        oddsScore:1500
      },{
        quantity:1,
        asset:"GIFT",
        oddsScore:700
      },{
        quantity:1,
        asset:"ECOJK.HYOU",
        oddsScore:500
      },{
        quantity:1,
        asset:"JAVASCRIPT",
        oddsScore:500
      },{
        quantity:1e8,
        asset:"KRSW",
        oddsScore:300
      },{
        quantity:1,
        asset:"MONAICON",
        oddsScore:500
      },{
        quantity:1,
        asset:"MAGATAMAVT",
        oddsScore:100
      },{
        quantity:1,
        asset:"MAGATAMATQ",
        oddsScore:100
      },{
        quantity:1,
        asset:"MAGATAMAWT",
        oddsScore:100
      }]
    },
    request:false,
    receiveAndReturn:{
      
    }
  },
  service:{
    port:process.env.PORT||((process.env.NODE_ENV==="production")?80:3939)
  }
}

