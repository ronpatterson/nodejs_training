// BugTrack - nodejs version
// Ron Patterson, BPWC
// 1/18/2016

var express = require('express'),
    app = express(),
    MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    engines = require('consolidate'),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    dateFormat = require('dateformat'),
    crypto = require('crypto'),
    assert = require('assert');

var lookups = [];

app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(bodyParser.urlencoded({ extended: true })); 

// Handler for internal server errors
function errorHandler(err, req, res, next) {
    console.error(err.message);
    console.error(err.stack);
    res.status(500).render('error_template', { error: err });
}

function getBTlookup ( type, cd ) {
	var arr = lookups[type];
	for (var x=0; x<arr.length; ++x) {
		if (arr[x]['cd'] === cd) return arr[x]['descr'];
	}
}

MongoClient.connect('mongodb://localhost:27017/bugtrack', function(err, db) {

    assert.equal(null, err);
    console.log("Successfully connected to MongoDB.");

	app.get('/', function(req, res, next) {
		res.render('bugtrack');
	});

    app.get('/js', function(req, res) {
		var doc = fs.readFileSync('./views/bugtrack.js');
		res.send(doc);
    	res.end();
    });

    app.get('/css', function(req, res) {
		var doc = fs.readFileSync('./views/bugtrack.css','utf-8');
		//console.log(doc);
		res.send(doc);
    	res.end();
    });

    app.get('/img/:name', function(req, res) {
		var doc = fs.readFileSync('./views/'+req.params.name);
		res.send(doc);
    	res.end();
    });
    
    app.get('/bt_init', function(req, res) {
        var cursor = db.collection('bt_lookups').find({});
        cursor.project({'_id':0});
        var results = {};
		cursor.forEach(function(doc) {
		    //assert.equal(null, doc);
			["bt_type","bt_group","bt_status","bt_priority"].forEach(function(element, index, array) {
				var arr = [];
				doc[element].forEach(function(element2, index2, array2) {
					if (element2.active == "y")
						arr.push({"cd":element2.cd,"descr":element2.descr});
				});
				results[element] = arr;
			})
		}, function(err) {
		    assert.equal(null, err);
			results.roles = "admin";
			//console.log(results);
			lookups = results;
			//console.log(lookups);
			res.json(results);
			res.end();
		});
    });

    app.get('/bugList', function(req, res) {
        db.collection('bt_bugs')
        .find({})
        .sort({'bug_id':1})
        .toArray(function(err, bugs) {
//             app.render('bugList', { 'bugs': bugs }, function(err, html) {
//             	document.getElementById('bug_list').innerHTML(html);
//             });
			res.render('bugList', { 'bugs': bugs });
        });
    });

    app.get('/bug_list', function(req, res) {
    	var results = [];
    	var crit = {};
    	var crit0 = req.query.crit;
    	if (crit0 && crit0.length > 1)
    		crit = {'$and':crit0};
        var cursor = db.collection('bt_bugs').find(crit);
        cursor.sort({'bug_id':1})
		cursor.forEach(function(doc) {
        	//console.log(doc);
        	//doc.entry_dtm = date("m/d/Y g:i a",doc.entry_dtm.sec);
        	doc.entry_dtm = dateFormat(doc.entry_dtm,'mm/dd/yyyy h:MM tt');
        	doc.status = getBTlookup("bt_status",doc.status);
	        results.push(doc);
		}, function(err) {
		    assert.equal(null, err);
		    results = {'data':results};
			//console.log(results);
			res.json(results);
			res.end();
		});
    });

    app.get('/bug_get', function(req, res) {
    	var id = req.query.id;
        db.collection('bt_bugs')
        .findOne({'_id':new ObjectId(id)},function(err, bug) {
		    assert.equal(null, err);
		    bug.edtm = dateFormat(bug.entry_dtm,'mm/dd/yyyy h:MM tt');
		    bug.udtm = typeof(bug.update_dtm) == 'undefined' ? '' : dateFormat(bug.update_dtm,'mm/dd/yyyy h:MM tt');
		    bug.cdtm = typeof(bug.closed_dtm) == 'undefined' ? '' : dateFormat(bug.closed_dtm,'mm/dd/yyyy h:MM tt');
		    if (typeof(bug.worklog) != 'undefined') {
		    	for (var i=0; i<bug.worklog.length; ++i) {
				    bug.worklog[i].edtm = typeof(bug.worklog[i].entry_dtm) == 'undefined' ? '' : dateFormat(bug.worklog[i].entry_dtm,'mm/dd/yyyy h:MM tt');
		    	}
		    }
		    if (typeof(bug.attachments) != 'undefined') {
		    	for (var i=0; i<bug.attachments.length; ++i) {
				    bug.attachments[i].edtm = typeof(bug.attachments[i].entry_dtm) == 'undefined' ? '' : dateFormat(bug.attachments[i].entry_dtm,'mm/dd/yyyy h:MM tt');
		    	}
		    }
		    console.log(bug);
	        res.json(bug);
	        res.end();
        });
    });
	
	app.post('/bug_add', function(req, res, next) {
		var title = req.body.title,
			year = req.body.year,
			imdb = req.body.imdb;
		if (typeof(title) == 'undefined' || title.trim() == '' || typeof(year) == 'undefined' || year.trim() == '' || typeof(imdb) == 'undefined' || imdb.trim() == '') {
			next('Please fill in all fields!');
		}
		else {
			// setup the movie document
			var doc = { 'title': title, 'year': year, 'imdb': imdb };
			var rec = db.collection('movies')
			.insert(doc, function(err, result) {
			    assert.equal(err, null);
				res.send("Inserted title: " + title + ", year: " + year + ", imdb: " + imdb);
			    console.log("Inserted a document into the movies collection.");
    		});
		}
	});

    app.get('/admin_users', function(req, res) {
    	//console.log('admin_users called ');
    	//console.log(req);
    	var crit = {};
    	var temp = [];
    	// check for possible criteria
    	var lname = req.query.lname;
    	var fname = req.query.fname;
    	if (lname && lname.trim() != '')
    		temp.push({'lname':{'$regex':'^'+lname,'$options':'i'}});
    	if (fname && fname.trim() != '')
    		temp.push({'fname':{'$regex':'^'+fname,'$options':'i'}});
    	if (temp.length == 2)
    		crit = {'$and':temp};
    	else if (temp.length == 1)
    		crit = temp[0];
    	var results = [];
        var cursor = db.collection('bt_users').find(crit);
        cursor.sort([['lname',1],['fname',1]]);
    	//console.log(cursor);
		cursor.forEach(function(doc) {
        	//console.log(doc);
	        doc.name = doc.lname + ', ' + doc.fname;
	        results.push(doc);
		}, function(err) {
		    assert.equal(null, err);
		    //results['data'] = results;
			//console.log(results);
			res.json(results);
			//res.send('<p>here</p>');
			res.end();
		});
    });

    app.get('/user_get', function(req, res) {
    	var uid = req.query.uid;
        db.collection('bt_users')
        .findOne({'uid':uid},function(err, user) {
		    assert.equal(null, err);
		    //console.log(user);
		    user.name = user.lname + ', ' + user.fname;
	        res.json(user);
	        res.end();
        });
    });

	app.post('/user_add_update', function(req, res, next) {
		// uid, lname, fname, email, active, roles, pw, bt_group
		var pw5 = crypto.createHash('md5').update(req.body.pw).digest("hex");
		// check action
		//console.log(req.body); res.end('TEST'); return;
		if (req.body.id == '') { // add
			var doc = {
  "uid": req.body.uid2
, "lname": req.body.lname
, "fname": req.body.fname
, "email": req.body.email
, "active": req.body.active
, "roles": [req.body.roles]
, "pw": pw5
, "bt_group": req.body.bt_group
};
			var rec = db.collection('bt_users')
			.insert(doc, function(err, result) {
				assert.equal(err, null);
				console.log("Inserted a document into the bt_users collection.");
				console.log(result);
				res.send('SUCCESS');
				res.end();
			});
		}
		else { // update
			if (req.body.pw == req.body.pw2) pw5 = req.body.pw;
			else pw5 = crypto.createHash('md5').update(req.body.pw).digest("hex");;
			var doc = {
  "lname": req.body.lname
, "fname": req.body.fname
, "email": req.body.email
, "active": req.body.active
, "roles": [req.body.roles]
, "pw": pw5
, "bt_group": req.body.bt_group
};
			var id = req.body.id;
			var rec = db.collection('bt_users')
			.update({'_id':new ObjectId(id)}, {'$set': doc}, function(err, result) {
				assert.equal(err, null);
				console.log("Updated a document in the bt_users collection.");
				console.log(result);
				res.send('SUCCESS');
				res.end();
			});
		}
	});

	app.use(errorHandler);

	var server = app.listen(3000, function() {
		var port = server.address().port;
		console.log('Express server listening on port %s.', port);
	});

});
