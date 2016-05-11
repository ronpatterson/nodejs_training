// BugTrack - nodejs server module
// Ron Patterson, BPWC
// 1/18/2016

'use strict';

// load required modules
const express = require('express'),
	app = express(),
	MongoClient = require('mongodb').MongoClient,
	engines = require('consolidate'),
	bodyParser = require('body-parser'),
	path = require("path"),
	assert = require('assert'),
	Bugtrack = require('./bugtrack'),
	bt = new Bugtrack();

// globals
const mongo_host = 'localhost',
	mongo_port = '27017';

// setup express.js
app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true })); 
console.log('Current directory: ',process.cwd());

function app_init (db) {
	// load lookups with the bt_lookups and bt_users collections
	var cursor = db.collection('bt_lookups').find( { } );
	var results = {};
	cursor.forEach((doc) => {
		//assert.equal(null, doc);
		var arr = [];
		var id = doc._id;
		doc.items.forEach((element, index, array) => {
			if (element.active == "y")
				arr.push({"cd":element.cd,"descr":element.descr});
		});
		results[id] = arr;
	}, (err) => {
		assert.equal(null, err);
		results.roles = "admin";
		results.users = {};
		// get users for lookups
		var cursor = db.collection('bt_users').find( { } );
		cursor.forEach((doc) => {
			//console.log(doc);
			doc.name = doc.lname + ', ' + doc.fname;
			results.users[doc.uid] = doc;
		}, (err) => {
			assert.equal(null, err);
			//console.log(results);
			bt.put_lookups(results);
		});
	});
}

MongoClient.connect('mongodb://'+mongo_host+':'+mongo_port+'/bugtrack', (err, db) => {

	assert.equal(null, err);
	console.log("Successfully connected to MongoDB.");
	app_init(db);
	//debugger;
	setInterval(function() {app_init(db)},60000); // refresh lookups

	app.get('/', function(req, res, next) {
		res.render('bugtrack');
	});

	app.get('/bt_init', function(req, res) {
		app_init(db, req, res);
		res.json(bt.get_lookups());
		res.end();
		//console.log('Lookups loaded');
	});

	app.get('/bugList', function(req, res) {
		bt.bugList(db, req, res);
	});

	app.get('/bug_list', function(req, res) {
		bt.bug_list(db, req, res);
	});

	app.get('/bug_get', function(req, res) {
		bt.bug_get(db, req, res);
	});
	
	app.post('/bug_add_update', function(req, res, next) {
		bt.bug_add_update(db, req, res, next);
	});

	app.post('/bug_delete', function(req, res) {
		bt.bug_delete(db, req, res);
	});

	app.post('/worklog_add', function(req, res, next) {
		bt.worklog_add(db, req, res, next);
	});

	app.post('/worklog_updateX', function(req, res, next) {
		bt.worklog_updateX(db, req, res, next);
	});

	app.post('/assign_user', function(req, res, next) {
		bt.assign_user(db, req, res, next);
	});

	app.post('/bug_email', function(req, res, next) {
		bt.bug_email(db, req, res, next);
	});

	//app.post('/attachment_add', upload.single('upfile'), function(req, res, next) {
	app.post('/attachment_add', (req, res, next) => {
		bt.attachment_add(db, req, res, next);
	});

	app.post('/attachment_delete', function(req, res) {
		bt.attachment_delete(db, req, res);
	});

	app.get('/admin_lu_list', function(req, res) {
		bt.admin_lu_list(db, req, res);
	});

	app.get('/admin_lu_get', function(req, res) {
		bt.admin_lu_get(db, req, res);
	});

	app.post('/lu_add_update', function(req, res, next) {
		bt.lu_add_update(db, req, res, next);
	});

	app.get('/admin_users', function(req, res) {
		bt.admin_users(db, req, res);
	});

	app.get('/user_get', function(req, res) {
		bt.user_get(db, req, res);
	});

	app.post('/user_add_update', function(req, res, next) {
		bt.user_add_update(db, req, res, next);
	});

	app.use(bt.errorHandler);

	var server = app.listen(3000, function() {
		var port = server.address().port;
		console.log('Express server listening on port %s.', port);
	});

}); // MongoClient.connect
