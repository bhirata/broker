// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var request = require('request');
var zmq = require('zmq');

// create a new express server
var app = express();

var port = 10000;
var hostname = 'localhost';
var hostname_zmq_sub_broadcast = 'tcp://127.0.0.1:5555';
var hostname_zmq_sub_validateUser = 'tcp://127.0.0.1:5556';

app.set('view engine', 'ejs');
app.set('views', __dirname + '/public');
app.use(express.static(__dirname + '/public'));

// var url_MarketStatus = 'http://localhost:10002/';


var marketStatuss = '';
var users = new Array();
var whoami = -1;
var acoes = new Array();
var contas = new Array();
var ordems = new Array();
var upStock;


function updateStock () {
  // console.log(ordems[whoami]);
  for (var i in ordems[whoami]) {
    console.log("i " + i);
  }
}

var sock_sub = zmq.socket('sub');
var sock_req = zmq.socket('req');

sock_sub.connect(hostname_zmq_sub_broadcast);
sock_sub.subscribe('');
console.log('Subscriber connected to port 5565');

sock_sub.on('message', function(topic, message) {
  
  if(topic.toString('ascii') == 'broadcast'){ 
    marketStatuss = JSON.parse(message.toString('ascii'));
  }
  if(topic.toString('ascii') == '888'){ 
    // logica das ordems
    upStock = JSON.parse(message.toString('ascii'));
    updateStock();
  }
});

sock_req.connect(hostname_zmq_sub_validateUser);



app.get('/', function(req, res){

  res.render('index');
});



//Retorna o login.html
app.get('/login', function(req, res){

  res.render('login');
});

//Tratamento do envio do form
app.get('/login_get', function (req, res) {

   // Prepare output in JSON format
   response = {
       cpf:req.query.cpf,
       pwd:req.query.pwd
   };

   for (var u in users) {
      var user = users[u];
     if(response.cpf == user.cpf && response.pwd == user.pwd){
        whoami = u;
        res.render('user');
     }
   };

});



//Retorna o cadastro.html
app.get('/cadastro', function(req, res){

  res.render('cadastro');
});

//Tratamento do envio do form
app.get('/cadastro_get', function (req, res) {

   // Prepare output in JSON format
   response = {
       username:req.query.username,
       pwd:req.query.pwd,
       conf_pwd:req.query.conf_pwd,
       cpf:req.query.cpf
   };

   var msg = {
    user_id: response.cpf,
    broker_id: 888
   }

   var user = response;

   if(response.pwd == response.conf_pwd){

    res.render('login');

    var allowed = '';

    sock_req.send(JSON.stringify(msg));
    sock_req.on('message', function(m){
      allowed = JSON.parse(m.toString('ascii'));
    

      console.log(allowed["status"]);

      if (allowed["status"] == "allowed"){

        console.log("Authorized");
        var ordem = new Array();
        var acao = new Array();
        var conta = {saldo : 0};


          for (var i in marketStatuss["stocks"]){
            var key = Object.keys(marketStatuss["stocks"][i]);
            var temp = {
              code: key[0],
              amount: 1000
            }
            acao.push(temp);
          }

          acoes.push(acao);

        users.push(user);
        contas.push(conta);
        ordems.push(ordem);

      }
     });
   }

});



app.get('/minhacarteira', function(req, res){

  res.render('minhaCarteira', {acoes:acoes[whoami]});
});



app.get('/listaAcao', function(req, res){

  var acao = new Array();

      for (var i in marketStatuss["stocks"]){
        var key = Object.keys(marketStatuss["stocks"][i]);
        var temp = {
          code: key[0],
          price: marketStatuss["stocks"][i][key[0]][0]
        }
        acao.push(temp);
      }

      res.render('listaAcao', {acoes: acao});
});



app.get('/minhaConta', function(req, res){

  res.render('minhaConta');
});



app.get('/deposito', function(req, res){

  res.render('deposito', {saldo: contas[whoami].saldo});
});

app.get('/deposito_get', function(req, res){

  response = {
       amount:req.query.amount
   };

   contas[whoami].saldo = parseInt(contas[whoami].saldo) + parseInt(response.amount);

  res.render('deposito', {saldo: contas[whoami].saldo});
});



app.get('/saque', function(req, res){

  res.render('saque', {saldo: contas[whoami].saldo});
});

app.get('/saque_get', function(req, res){

  response = {
       amount:req.query.amount
   };

   contas[whoami].saldo = parseInt(contas[whoami].saldo) - parseInt(response.amount);

  res.render('saque', {saldo: contas[whoami].saldo});
});



app.get('/compraAcao', function(req, res){

  var acao = new Array();


      for (var i in marketStatuss["stocks"]){
        var key = Object.keys(marketStatuss["stocks"][i]);
        var temp = {
          code: key[0],
          price: marketStatuss["stocks"][i][key[0]][0],
          price_buy: marketStatuss["stocks"][i][key[0]][1]
        }
        acao.push(temp);
      }

      res.render('compraAcao', {acoes: acao});
});

app.get('/compraAcao_get', function(req, res){

  r = {
       option:req.query.option,
       amount:req.query.amount,
       price:req.query.price
   };

   var stockValue = 0;
   var stockCode = '';

  var acao = new Array();


      for (var i in marketStatuss["stocks"]){
        var key = Object.keys(marketStatuss["stocks"][i]);
        var temp = {
          code: key[0],
          price: marketStatuss["stocks"][i][key[0]][0],
          price_buy: marketStatuss["stocks"][i][key[0]][1]
        }
        acao.push(temp);
      }

      var ordem = {
          type: "purchase",
          stock: acao[r.option].code,
          amount: r.amount,
          price: acao[r.option].price,
          user_id: users[whoami].cpf,
          broker_id: 888
       }

      sock_req.send(JSON.stringify(ordem));
      sock_req.on('message', function(m){
        var x = JSON.parse(m.toString('ascii'));
        var o = {
          type: "purchase",
          stock: acao[r.option].code,
          amount: r.amount,
          price: acao[r.option].price,
          user_id: users[whoami].cpf,
          broker_id: 888,
          id: x["id"]
        }
        ordems[whoami].push(o);
      });

      stockValue = r.price;
      stockCode = acao[r.option].code;

      contas[whoami].saldo = parseFloat(contas[whoami].saldo) - (parseFloat(r.amount) * parseFloat(stockValue));

      acoes[whoami].push({
        code: stockCode,
        amount: r.amount
      });

      res.redirect('/compraAcao');
});



app.get('/venderAcao', function(req, res){

  var acao = acoes[whoami];

  res.render('venderAcao', {acoes: acao});
});

app.get('/venderAcao_get', function(req, res){

  var r = {
       option:req.query.option,
       amount:req.query.amount,
       price:req.query.price
  };

   var ordem = {
        type: "sell",
        stock: acoes[whoami][r.option].code,
        amount: r.amount,
        price: r.price,
        user_id: users[whoami].cpf,
        broker_id: 888
      }

  sock_req.send(JSON.stringify(ordem));
  sock_req.on('message', function(m){
    var x = JSON.parse(m.toString('ascii'));
    var o = {
      type: "sell",
      stock: acoes[whoami][r.option].code,
      amount: r.amount,
      price: r.price,
      user_id: users[whoami].cpf,
      broker_id: 888,
      id: x["id"]
    }
    ordems[whoami].push(o);
  });


  acoes[whoami][r.option].amount = parseInt(acoes[whoami][r.option].amount) - parseInt(r.amount);
  contas[whoami].saldo = parseFloat(contas[whoami].saldo) + (parseFloat(r.amount) * parseFloat(r.price));

  if(parseInt(acoes[whoami][r.option].amount) == 0){
    acoes[whoami].splice(r.option, 1);
  }

  var acao = acoes[whoami];

  res.render('venderAcao', {acoes: acao});
});



app.get('/listaOrdem', function(req, res){

  res.render('listaOrdem', {ordems: ordems[whoami]});
});

app.get('/listaOrdem_get', function(req, res){
  r = {
       option:req.query.option
  };

  // console.log(ordems[whoami]);

  var o = {
    id: ordems[whoami][r.option]["id"],
    user_id: users[whoami].cpf
  }
  console.log("listaOrdem" + ordems[whoami][r.option]);

  sock_req.send(JSON.stringify(o));
  sock_req.on('message', function(m){
    var x = JSON.parse(m.toString('ascii'));
    console.log(x);
  });

  ordems[whoami].splice(r.option, 1);

  res.render('listaOrdem', {ordems: ordems[whoami]});
});


// start server on the specified port and binding host
var server = app.listen(port, hostname, function() {
  // print a message when the server starts listening

  console.log("server starting on " + server.address().address + ":" + server.address().port);
});
