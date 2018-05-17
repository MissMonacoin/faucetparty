var api = "/api";
var token = "";
var errors={
  AddressHasBeenUsed:"モナコインを使ったことのあるお友達はつかえません(*_ _)人ｺﾞﾒﾝﾅｻｲ / Friends who have ever used Monacoin can't use. Sorry.",
  RecaptchaRequired:"画像認証に失敗しました。/ Failed to verify recaptcha",
  RecaptchaFailed:"初めからやり直してください(*_ _)人ｺﾞﾒﾝﾅｻｲ / Please try again. Sorry(*_ _)人",
  VerificationFailed:"署名が間違っています。/ Signature is incorrect"
  
}
var queries = location.search.substr(1).split("&").reduce(function (a, b) {
  var kv = b.split("=");
  a[kv[0]] = decodeURIComponent(kv[1])
  return a;
}, {});

if (queries.signature) {
  document.getElementById("initial").style.display = "none";
} else if (typeof queries.question !== "undefined") {
  document.getElementById("sig").style.display = "none";
  var a=queries.question
  var arr=[]
  var str=null
  for(var i = 0;i<a.length;i++){
	  if(typeof(str)==="string"){
		  if(a[i]==="]"){
			  arr.push(str)
			  str=null
      }else{
			  str+=a[i]
      }
		  continue
	  }
	  switch(a[i].toLowerCase()){
      case "[":
			  str=""
		    break;
      case "y":
			  arr.push(true)
		    break;
		  case "n":
			  arr.push(false)
		    break;
		  case "x":
			  arr.push(null)
		    break;
      default:
			  arr.push(parseInt(a[i],16))
	  }
  }
  for(var j=0;j<arr.length;j++){
    ga('set', 'dimension'+j, arr[j]);
  }
} else {
  document.getElementById("initial").style.display = "none";
  document.getElementById("sig").style.display = "none";
}
ga('send', 'pageview');
function goToMonya() {
  const u="monacoin:api_v1_signMsg?param=" + encodeURIComponent(JSON.stringify({
    addrIndex: 0,
    payload: queries.question,
    message: token,
    coinId: "mona",
    callbackPage: location.origin + location.pathname
  }))
  
  if(queries.isNative==="true"){
    location.href=u;
  }else{
    location.href=("https://monya-wallet.github.io/wallet/?url=" + encodeURIComponent(u));
  }
}
function verified(d) {
  token = d;
  var mbtn = document.getElementById("openMonya");
  mbtn.classList.add("pulse");
  mbtn.disabled = false;
}

function sendReq() {
  axios.post(api + "/faucet/random", {
    dest: queries.address,
    signature: queries.signature,
    recaptchaResponse: queries.message,
    memo: queries.payload
  }).then(function (r) {
    document.getElementById("rcvCard").style.display = "block";
    document.getElementById("cur").innerText = r.data.chosen.divisible?r.data.chosen.quantity/1e8:r.data.chosen.quantity + " " + r.data.chosen.asset;
  }).catch(function (e) {
    try{
      alert(errors[JSON.parse(e.request.responseText).error])
    }catch(error){
      alert("Error:" + e);
    }
  });
}

var b = document.getElementsByClassName("addr")
for(var i = 0; i < b.length; i++)
{
  var a=b.item(i)
  if (queries.isNative!=="true") {
    a.href="https://monya-wallet.github.io/wallet/?url="+a.href
  }
}
