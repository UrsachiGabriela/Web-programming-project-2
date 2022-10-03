
const cookieParser=require('cookie-parser');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser')

// Importing express-session module
const session = require("express-session");
const flash=require('connect-flash');
const ipfilter = require('express-ipfilter').IpFilter;
const IpDeniedError = require('express-ipfilter').IpDeniedError;


const sqlite3 = require('sqlite3');
const { exit } = require('process');
const { time } = require('console');

const app = express();
var ips = []; 
var loginErrorCount=0;
const MAX_LOGIN_ERRORS=3;

const port = 6789;

const util = require('util');
const { redirect, json, render } = require('express/lib/response');
const { request } = require('http');

// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');

app.use(cookieParser())

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

// Creating session 
app.use(session({
    name: "session-id",
    secret: "GFGEnter", // Secret key,
    saveUninitialized: false,
    resave: false,

}));


app.use(function(err, req, res, _next) {
	  console.log('Error handler', err);
	 
	  if(err instanceof IpDeniedError){
		res.status(401);
	  }else{
		res.status(err.status || 500);
	  }
  
	  res.render('error', {
		message: 'Nu ai acces la acest site pentru 60 secunde.',
	  });
	});
  


var produse=[];

function queryProducts(){
	return new Promise(function(resolve){
		//console.log("in afara conexiunii\n");
		let myDB=new sqlite3.Database('cumparaturi.db',(err)=>{
			if(err){
				console.log("Eroare de conexiune la baza de date : "+err);
				exit(1);
			}
			
	
			//console.log("in conexiune\n");
			let i=0;
			
			myDB.all(`select * from produse`, (err, rows) => {
				if (err) {
					console.log(err);
					exit(1);
				}
				//console.log("in query \n");
				rows.forEach(row => {
					produse[i] = row;
					i++;
				});
				
				resolve(produse);
			})
	
			
			myDB.close();
			
	
		});
	
	});
	


}



function querySomeProducts(numeProdus){
	let result=[]
	return new Promise(function(resolve){
		//console.log("in afara conexiunii\n");
		let myDB=new sqlite3.Database('cumparaturi.db',(err)=>{
			if(err){
				console.log("Eroare de conexiune la baza de date : "+err);
				exit(1);
			}
			
	
			//console.log("in conexiune\n");
			let i=0;
	
			let c="' or 1=1 #'";
			//myDB.all(`select * from produse where numeProdus = ? or numeProdus like '%'||?||'%'`,[numeProdus,numeProdus], (err, rows) => {
				myDB.all(`select * from produse where numeProdus = ?`,[numeProdus], (err, rows) => {	
				if (err) {
					console.log(err);
					exit(1);
				}
				console.log(rows.length);
				
					rows.forEach(row => {
						console.log(row);
						result[i] = row;
						i++;
					});
					
					resolve(result);
	
					
		
			})
	
			
			myDB.close();
			
	
		});
	
	});
	


}

app.get('/cauta-produs', (req, res) => {
	if(Object.keys(req.query).length === 0){
		console.log("fara parametri");
		res.render('cauta-produs',{result:null,user:req.session.user});
	}	
	else{
		//console.log(req.query.numeProdus);
		console.log("cu parametri : "+req.query.numeProdus);

		querySomeProducts(req.query.numeProdus).then((prod) => {
			//console.log(prod);
			
			res.render('cauta-produs',{result:prod,user:req.session.user});
		});		
		
	}
	
});


// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
//app.get('/', (req, res) => res.send('Hello World'));
app.get('/', (req, res) => {
	
	
	

	queryProducts().then((prod) => {
	
		if ( req.session.user == "undefined"){
			res.render('index',{user:null,produse:prod});
		}
		else{
	
			
			//console.log("USER "+req.session.user)
			res.render('index',{user:req.session.user,produse:prod})
		}
	});
	


	

	/*
	
	if(req.cookies.utilizator != null){
		res.render('index',{user:req.cookies.utilizator});
	}
	else{
		res.render('index',{user:null});
	}
	*/
	
});

app.get('/autentificare', (req, res) =>{
	if(loginErrorCount==MAX_LOGIN_ERRORS){
		
		res.render('error',{message:"Max login attempts : 3"})
	}
	else{

		if(req.cookies.mesajEroare == null)
		{
			res.render('autentificare',{mesaj:null})
		}
		else {
			let eroare=req.cookies.mesajEroare;
			res.clearCookie("mesajEroare");
			res.render('autentificare',{mesaj:eroare})
		}
	
		/*if(req.cookies.mesajEroare == null)
		{
			res.render('autentificare',{mesaj:null})
		}
		else {
			res.render('autentificare',{mesaj:req.cookies.mesajEroare})
		}	
		*/
	}

});

//statutul de admin va fi retinut intr-o variabila de sesiune
// req.session.isAdmin=true pt admin 
// req.session.isAdmin=false pt ceilalti utilizatori
app.post('/verificare-autentificare', (req, res) => {


	const fs=require('fs');
	var listaUtilizatori

	fs.readFile('admin.json',(err,data)=>{
		if(err) throw err;
		user=JSON.parse(data);

		//daca sunt introduse datele admin-ului , nu se mai fac verificari pt utilizatori
		if(user.utilizator==req.body.username && user.parola==req.body.parola){
			req.session.user=req.body.username;	
			req.session.listaCumparaturi=[];
			req.session.isAdmin=true;
			loginErrorCount=0;
			res.redirect("/");
		}
		else{
			req.session.isAdmin=false;

			fs.readFile('utilizatori.json',(err,data)=>{
				if(err) throw err;
				listaUtilizatori=JSON.parse(data);
				
		
		
				//se considera ca username-ul si parola sunt corecte daca 
				//sunt in lista de utilizatori
				var loggedUser;
				for(let x in listaUtilizatori)
				{
					let currentUsername=listaUtilizatori[x].utilizator;
					let currentPass=listaUtilizatori[x].parola;
					if(currentUsername==req.body.username && currentPass==req.body.parola){
						loggedUser=listaUtilizatori[x];
						loginErrorCount=0;
						break;
					}
				}
		
				if(loggedUser!=undefined) // datele introduse sunt corecte
				{
					req.session.user=loggedUser.utilizator;		
					req.session.nume=loggedUser.nume;			
					req.session.prenume=loggedUser.prenume;
					req.session.email=loggedUser.email;
					req.session.telefon=loggedUser.telefon;
					req.session.varsta=loggedUser.varsta;
					req.session.listaCumparaturi=[];
		
					loginErrorCount=0;
	
					console.log(req.session);
			
					res.redirect("/");
				
				}
				else{ // datele introduse sunt eronate
					//res.cookie("utilizator",req.body.username);
					loginErrorCount++;
/*
					if(loginErrorCount==MAX_LOGIN_ERRORS){
						addToBlocklist(req.ip);
					}
*/
					res.cookie("mesajEroare","Utilizator sau parola gresite !");
					res.redirect("/autentificare")
				}
			})
		
		}
	})



	

	
});

app.get('/delogare', (req, res) =>{
	
	//req.session.user=undefined;
	req.session.destroy();
	res.redirect('/');
});

// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
app.get('/chestionar', (req, res) => {	
	var loggedUser
	if (typeof req.session.user != "undefined")
	{
		loggedUser=req.session.user
	}


	// în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări
	const fs=require('fs');

	fs.readFile('intrebari.json',(err,data)=>{
		if(err) throw err;
		let listaIntrebari=JSON.parse(data);
		res.render('chestionar', {intrebari: listaIntrebari,user:loggedUser});
	})
	
	
});

app.post('/rezultat-chestionar', (req, res) => {
	var loggedUser
	if (typeof req.session.user != "undefined")
	{
		loggedUser=req.session.user
	}

	console.log(req.body);
	//res.send("formular: " + JSON.stringify(req.body));

	const fs=require('fs');

	fs.readFile('intrebari.json',(err,data)=>{
		if(err) throw err;
		let listaIntrebari=JSON.parse(data);
		
		var counter=0;
		let i=0;

		for (var key in req.body){
			if(req.body[key]==listaIntrebari[i].corect){
				counter++;
			}
			i++;
		}

		
		res.render('rezultat-chestionar',{raspunsuri_corecte:counter,user:loggedUser});

	})
	

		//res.render('rezultat-chestionar', {intrebari: listaIntrebari});
});


app.get('/creare-bd', (req, res) => {
//Serverul se conectează la serverul de baze de date
// și creează o bază de date cu numele cumparaturi, 
//în care creează o tabelă produse, după care răspunde
// clientului cu un redirect spre resursa /.

	let myDB=new sqlite3.Database('cumparaturi.db',(err)=>{
		if(err){
			console.log("Eroare de conexiune la baza de date : "+err);
			exit(1);
		}

		myDB.exec(`create table produse(
			idProdus integer primary key autoincrement,
			numeProdus text not null unique
		);` 
		, (err)=>{
			if(err){
				console.log("Tabela exista deja in baza de date.");
			}
			else{
				console.log("Tabela a fost creata cu succes! ");
			}
			
		})

		myDB.close();
		res.redirect("/");

	});


});




app.get('/inserare-bd', (req, res) => {
//Serverul se conectează la serverul de baze de date
// și inserează mai multe produse în tabela produse,
// după care răspunde clientului cu un redirect spre resursa /.

	let myDB=new sqlite3.Database('cumparaturi.db',(err)=>{
		if(err){
			console.log("Eroare de conexiune la baza de date : "+err);
			exit(1);
		}

		myDB.exec( `insert into produse (numeProdus)
					values ('Apple IPhone 11 Pro'),
					('Apple IPhone 11 Pro Max'),
					('Apple IPhone 6S Plus'),
					('Huawei P Smart'),
					('Huawei P10 Lite'),
					('Huawei P20 Pro'),
					('Samsung Galaxy S10 Lite'),
					('Samsung Galaxy S20 Ultra'),
					('Samsung Galaxy Note 10+'),
					('Samsung Galaxy A20s'),
					('Xiaomi 12'),
					('Xiaomi Redmi Note 10'),
					('Nokia 4.2'),
					('Nokia 7.2'),
					('Honor 20 Lite'),
					('Honor 8A'),
					('Sony Xperia 5'),
					('Motorola Moto G30'),
					('Motorola Moto G60');` 
		, (err)=>{
			if(err)
			{
				console.log("Produsele sunt deja inserate in baza de date.");

			}
			else
			{
				console.log("Tabela produse a fost populata cu succes! ");
			}
					
		})
		
		
		myDB.close();
		res.redirect("/");

	});


});


app.post('/adauga-produs', (req, res) => {
	//Serverul se conectează la serverul de baze de date
	// și inserează mai multe produse în tabela produse,
	// după care răspunde clientului cu un redirect spre resursa /.
	let numeP=req.body.numeProdus;
	console.log("PRODUS : "+numeP);
	let sqlScript=`insert into produse(numeProdus)
					values ('${numeP}');`;
				
	let myDB=new sqlite3.Database('cumparaturi.db',(err)=>{
			if(err){
				console.log("Eroare de conexiune la baza de date : "+err);
				exit(1);
			}
	
			myDB.exec(sqlScript
			, (err)=>{
				if(err)
				{
					
					console.log(err);
					res.render('admin',{access:req.session.isAdmin,message:'Produsul deja există',user:req.session.user});
				
	
				}
				else
				{
					console.log("Inserat cu succes");
					res.render('admin',{access:req.session.isAdmin,message:undefined,user:req.session.user});
				}
						
			})
			
			
			myDB.close();
	
	
		});
	
	
});


app.post('/adaugare-cos', (req, res) => {
//Serverul adaugă id-ul produsului specificat
// în corpul mesajului HTTP într-un vector din
// variabila de sesiune (sau într-un vector global 
//dacă nu ați implementat tema 3 din laboratorul 11).
	console.log(req.body);
	req.session.listaCumparaturi.push(req.body.idProdus);

	console.log("CUMPARATURI : "+req.session.listaCumparaturi)

	res.redirect("/");
});
	


app.get('/vizualizare-cos', (req, res) => {
//Serverul răspunde cu o pagină de Vizualizare
// coș prin inserarea vizualizare-cos.ejs în layout.ejs 
//și returnarea rezultatului la client.
	let cumparaturi=[]; //un array de obiecte de tip JSON

	queryProducts().then((prod) => {
		for(const produs of prod)
		{
			if(req.session.listaCumparaturi.includes(produs.idProdus.toString() )==true){				
				cumparaturi.push({"idProdus":produs.idProdus , "numeProdus":produs.numeProdus});
			}
		}

		console.log(cumparaturi);
		res.render('vizualizare-cos',{listaCumparaturi:cumparaturi});
	});



	
});






app.get('/admin', (req, res) => {	
	if(req.session.isAdmin==true){
		res.render('admin',{access:true,message:undefined,user:req.session.username});
	}
	else{
		res.render('admin',{access:false,message:undefined,user:req.session.username});
	}
	
});

function addToBlocklist(ip){
	//se adauga in array doar daca nu exista deja
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



//1 minute
setInterval(() => {loginErrorCount=0; }, 60*1000 );

setInterval(() => {ips.shift(); }, 60*1000 );

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:`));