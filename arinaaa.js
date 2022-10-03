const cookieParser = require('cookie-parser');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser')
const mysql = require('mysql2');

const app = express();
const session = require("express-session");
const flash=require('connect-flash');
const ipfilter = require('express-ipfilter').IpFilter;
const IpDeniedError = require('express-ipfilter').IpDeniedError;
app.use(cookieParser());

const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    saveUninitialized:false,
    cookie: { maxAge: oneDay },
    resave: false 
}));


app.use(function(err, req, res, _next) {
	if(err instanceof IpDeniedError){
	  res.status(401);
	}else{
	  res.status(err.status || 500);
	}

	res.render('error', {
	  message: 'Nu veti avea acces la site timp de 60 de secunde.',
	});
  });

const port = 6789;

//JSON DATA
let jsonData = require('./intrebari.json');

const fs = require('fs');
const res = require('express/lib/response');
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(ipfilter(ips));

app.set('port', (6789));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
var data=[], records=[], ips = [];
let cumparaturi=[];
function getRecords(){
	return new Promise(resolve=>{
		con.query('SELECT * FROM produse ORDER BY produs_id',[],(err,rows) =>
		{
			if(err)
			{
				return console.error(err.message);
			}
			rows.forEach((row) =>
			{
				data.push(row);
				//console.log(row);
			});
			resolve(data);
		});
	});
}


async function asyncCall(){
	records = await getRecords();
}

app.get('/', (req, res) => {
	if(records.length == 0){
		asyncCall();
	}
	
	res.render('index', {user: req.cookies.dataUser, produse: records});
});

app.get('/autentificare', (req, res) => {
	
	var mesajEroare = req.cookies.mesajEroare;
	
	res.render('autentificare', {user: req.cookies.dataUser, eroare: mesajEroare});
});

app.post('/verificare-autentificare', (req, res) => { 
	res.clearCookie();
	var data = fs.readFileSync('utilizatori.json');
	var listaUtilizatori = JSON.parse(data);
	req.session.array_produse = [];
	listaUtilizatori.forEach(element => {
	{
		if((element.user === req.body.user) && (element.password === req.body.password))
		{
			res.cookie("dataUser", {user: req.body.user, password: req.body.password});
			console.log("Cookie utilizator! ");
			console.log(req.cookies.dataUser);
			
			req.session.cart = [];
			req.session.user = element.user;
			req.session.rol = element.rol;
			req.session.nume = element.nume;
			req.session.prenume = element.prenume;
			res.redirect('/');
			return;
		}
	}
	});
	if(req.cookies.mesajEroare)
	{
		res.cookie("mesajEroare", "User invalid sau parolă invalidă!"); 
		res.redirect('/autentificare');
	}
}
);

app.get('/logout', (req, res) => {
	req.session.destroy();
	res.clearCookie("dataUser");
    res.redirect('/autentificare');
});

// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
app.get('/chestionar', (req, res) => {
	
	res.render('chestionar', {user: req.cookies.dataUser, intrebari: jsonData});
});


app.post('/rezultat-chestionar', (req, res) => {

	var listaIntrebari;
	var data = fs.readFileSync('./intrebari.json');
	listaIntrebari = JSON.parse(data);

	data = req.body
	var userAnswers = []

	for(let answer in data)
	{	
		userAnswers.push(data[answer])
	}

	var result;
	if(userAnswers.length === listaIntrebari.length)
	{
		var nr = 0;
		for(var i = 0; i < listaIntrebari.length; i++)
		{
			
			if (listaIntrebari[i].corect == userAnswers[i])
			{
				nr++;
			}
		}
		result = "Ai răspuns corect la " + nr + " din " + listaIntrebari.length + " întrebări."
	}
	else
	{
		result = "Vă rugăm să refaceți întreg formularul, bifând câte un răspuns pentru fiecare opțiune!"
	}	
	res.render("rezultat-chestionar", {user: req.cookies.dataUser, quizResult: result});
});

var con = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "taeminoppa1"
  });

app.get('/creare-BD', (req, res) => {
	  con.connect(function(err) 
	  {
		if (err)
		{
			return console.error('Nu s-a putut stabili conexiunea cu baza de date: ' + err.message);
		}
		console.log("Connected!");
		con.query("CREATE DATABASE if not exists arinadatabase", function (err, result) 
		{
			if (err)
			{
				return console.error('Nu s-a putut crea baza de date arinadatabase: ' + err.message);
			}
			console.log("Database created");
		});
		con.query("use arinadatabase");
		con.query("CREATE TABLE if not exists produse (produs_id INT NOT NULL AUTO_INCREMENT, produs VARCHAR(50) NOT NULL, pret VARCHAR(20) NOT NULL , PRIMARY KEY (produs_id))", function (err, result) {
			if (err) 
			{
				return console.error('Nu s-a putut crea tabela produse: ' + err.message);
			}
			console.log("Table created");
		  });
	  });
	res.redirect('/');
});


app.get('/inserare-BD', (req, res) => {
	con.connect(function(err) {
		if (err) 
		{
			return console.error('Nu s-a putut stabili conexiunea cu baza de date: ' + err.message);
		}
		console.log("Connected!");
		con.query("use arinadatabase");
		var sql = "INSERT INTO produse (produs_id, produs, pret) VALUES ?";
  		var values = [
			[null, 'pachet hartie colorata','25lei'],
			[null, 'mapa de plastic','5lei'],
			[null, 'perforator','40lei'],
			[null, 'pix cu gel','2lei'],
			[null, 'capsator','50lei'],
			[null, 'plicuri set','90lei'],
			[null, 'flipchart','300lei'],
			[null, 'marker','9lei'],
			
			
		  ];
		con.query(sql, [values], function (err, result){
			if (err) 
			{
				return console.error('Nu s-au putut insera datele in tabela produse: ' + err.message);
			}
			console.log("1 record inserted");
		});
	  });
	res.redirect('/');
});

app.post('/adaugare_cos', (req, res) => {
	
	if(req.session.user)
	{  console.log(req.body);
		req.session.cart.push(req.body.produs_id);
		console.log(req.session.cart);
	}

	res.redirect('/vizualizare-cos');
});


app.get('/vizualizare-cos', (req, res) => {
	var sql = "SELECT produs_id, produs, pret FROM produse";
	con.query(sql, req.session.cart,(err,rows) =>
	{
		if(err)
		{
			return console.error(err.message);
		}
		rows.forEach((row) =>
		{
                
				cumparaturi.push({"idProdus":row.produs_id , "numeProdus":row.produs, "pret": row.pret});
			
			
		});
		console.log(cumparaturi);
		res.render('vizualizare-cos', {user: req.cookies.dataUser, produse: cumparaturi});
	});
	
});

app.get('/admin',(req,res)=> {
  if(req.session.user){
    if(req.session.rol === "admin"){
      res.render('admin');
    }else{
      res.redirect('/');
    }
  }
});


app.post('/inserare-BD-admin', (req, res) => {
	con.connect(function(err) {
		if (err) 
		{
			return console.error('Nu s-a putut stabili conexiunea cu baza de date: ' + err.message);
		}
		console.log("Connected!");
		con.query("use arinadatabase");
		var sql = "INSERT INTO produse (produs_id, produs, pret) VALUE (?,?,?)";
  		var value = 
			[null, req.body.produs,req.body.pret];
			
		con.query(sql, value, function (err, result){
			if (err) 
			{
				return console.error('Nu s-au putut insera datele in tabela produse: ' + err.message);
			}
			console.log("1 record inserted");
		});
	  });
	res.redirect('/');
});

function addToBlocklist(ip){
	const index=ips.findIndex(object => {return object===ip});
	console.log(index);
	if(index===-1){
		ips.push(ip);
	}
}


app.use((req, res, next) => {

	addToBlocklist(req.ip);

	console.log(ips);
	res.status(404).send({
	status: 404,
	error: "Resource not found",
	})
});

setInterval(() => {ips.shift(); }, 60*1000 );

app.listen(port, () => console.log("Serverul rulează la adresa http://localhost:" + port));