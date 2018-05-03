var api = "/api";
var token = "";

var queries = location.search.substr(1).split("&").reduce(function (a, b) {
  var kv = b.split("=");
  a[kv[0]] = kv[1];
  return a;
}, {});

if (queries.signature) {
  document.getElementById("initial").style.display = "none";
} else if (typeof queries.question !== "undefined") {
  document.getElementById("sig").style.display = "none";
} else {
  document.getElementById("initial").style.display = "none";
  document.getElementById("sig").style.display = "none";
}
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
    document.getElementById("cur").innerText = r.data.chosen.quantity + " " + r.data.chosen.asset;
  }).catch(function (e) {
    alert("Error:" + e);
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
