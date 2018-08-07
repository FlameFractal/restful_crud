var express = require('express');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var session = require('express-session');

var app = express();
app.use(bodyParser.json());
app.use(session({
    secret: 'dakjsdsdasd  ',
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
    saveUninitialized: false,
    resave: false
}));

/* Postgres DB init stuff */
var Pool = require('pg').Pool;
var config = {
    user: process.env.S_USER || 'postgres',
    database: process.env.S_DB || 'restful_crud',
    password: process.env.S_PASSWORD || 'vishal',
    host: process.env.S_HOST || 'localhost',
    port: process.env.S_PORT || '5432',
};
var pool = new Pool(config);


/* Custom helper functions */
function escapeHtml(unsafe) {
    return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hash(input, salt) {
    var hashed = crypto.pbkdf2Sync(input, salt, 8000, 512, 'sha512');
    return ["pbkdf2", "8000", salt, hashed.toString('hex')].join('$');
}

function checkPermission(req,role){ //signed in, signed in with correct role
    if (!req.session || !req.session.username)
        return false
    if (role=='none')
        return true    
    if (req.session.role != role)
        return false 
    return true
}

/* API Endpoints */
app.post('/createUser', function (req, res) {
    
    if (!req.body.username || !req.body.password || !req.body.role) {
        return res.status(404).send(JSON.stringify({'success':'false', 'err': 'missing value'}))
    }
    
    var username = req.body.username
    var password = req.body.password
    var role = req.body.role;
    var salt = crypto.randomBytes(128).toString('hex');
    var saltyPwd = hash(password, salt);
    
    pool.query('INSERT INTO "s_users" (username, password, role) VALUES ($1, $2, $3)', [escapeHtml(username), escapeHtml(saltyPwd), escapeHtml(role)], function (err, result) {
        if (err)
            res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString() }));
        else
            res.status(200).send(JSON.stringify({'success':'true', 'username_created':username}));
    });
});

app.post('/login', function (req, res) {
    if (!req.body.username || !req.body.password) {
        return res.status(404).send(JSON.stringify({'success':'false', 'err': 'missing value' }));
    }
    var username = req.body.username;
    var password = req.body.password;
    
    pool.query('SELECT * FROM "s_users" WHERE username = $1', [escapeHtml(username)], function (err, result) {
        if (err) {
            res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString() }));
        } else {
            if (result.rows.length === 0) {
                res.status(404).send(JSON.stringify({ 'success': 'false', 'err': 'Invalid username/password'}));
            } else {
                // Match the password
                var storedSaltyPwd = result.rows[0].password;
                var salt = storedSaltyPwd.split('$')[2];
                var hashedPassword = hash(password, salt); // Creating a hash based on the password submitted and the original salt
                if (hashedPassword === storedSaltyPwd) {
                    // Set the session
                    req.session.username = result.rows[0].username;
                    req.session.role = result.rows[0].role; // {username:u, role:r}
                    res.send(JSON.stringify({ 'success': 'true', 'username_logged_in': username}));
                } else {
                    res.status(403).send(JSON.stringify({ 'success': 'false', 'err': 'Invalid username/password' }));
                }
            }
        }
    });
});

app.post('/add', function(req, res) {
    if(!checkPermission(req,'staff'))
        return res.status(500).send(JSON.stringify({'success': 'false', 'err':'Insufficient permission'}))
 
    if (!req.query.length || !req.query.breadth || !req.query.height || isNaN(parseInt(req.query.length)) || isNaN(parseInt(req.query.breadth)) || isNaN(parseInt(req.query.height)))
        return res.status(500).send(JSON.stringify({'success': 'false', 'err':'Missing value'}))

    length = parseInt(req.query.length)
    breadth = parseInt(req.query.breadth)
    height = parseInt(req.query.height)
    area = length*breadth
    volume = length*breadth*height
    created_by = req.session.username

    pool.query('INSERT INTO "s_cuboid" (length, breadth, height, area, volume, created_by, creation_date) VALUES ($1, $2, $3, $4, $5, $6, now())', [length, breadth, height, area, volume, created_by], function (err, result) {
        if (err)
            res.status(500).send(JSON.stringify({'success': 'false', 'err': err.toString()}))
        else
            res.send(JSON.stringify({'success':'true'}));
    });
});

app.post('/update', function(req, res) {
    if (!checkPermission(req, 'staff'))
        return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': 'Insufficient permission' }))
        
    if(!req.query.cubo_id)
        return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': 'Missing cubo_id'}))
    
    // get old dimensions
    // update new dimensions
    // update new derived values
    // store back new dimensions
    oldCuboid=''
    pool.query('SELECT * FROM "s_cuboid" WHERE cubo_id = $1', [req.query.cubo_id], function (err, result) {
        if (err)
            return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString() }));
            else{
                if (result.rows.length === 0) {
                    return res.status(404).send(JSON.stringify({ 'success': 'false', 'err': 'cubo_id doesnt exist' }))
            } else {
                oldCuboid = result.rows[0]    
                if (req.query.length && !isNaN(parseInt(req.query.length)))
                    oldCuboid.length = parseInt(req.query.length)
                if (req.query.breadth && !isNaN(parseInt(req.query.breadth)))
                    oldCuboid.breadth = parseInt(req.query.breadth)
                if (req.query.height && !isNaN(parseInt(req.query.height)))
                    oldCuboid.height = parseInt(req.query.height)
                oldCuboid.area = oldCuboid.length * oldCuboid.breadth
                oldCuboid.volume = oldCuboid.length * oldCuboid.breadth * oldCuboid.height
                
                pool.query('UPDATE "s_cuboid" SET length=$1, breadth=$2, height=$3, area=$4, volume=$5 WHERE cubo_id=$6', [oldCuboid.length, oldCuboid.breadth, oldCuboid.height, oldCuboid.area, oldCuboid.volume, req.query.cubo_id], function (err, result) {
                    if (err)
                        return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString() }));
                    else
                        res.send(JSON.stringify({'success':'true'}));
                });
            }
        }       
    });
});
      
app.delete('/delete', function(req, res) {
    if (!checkPermission(req, 'staff'))
        return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': 'Insufficient permission' }))
    if (!req.query.cubo_id)
        return res.status(404).send(JSON.stringify({ 'success': 'false', 'err': 'Missing cubo_id' }))

    pool.query('SELECT * FROM "s_cuboid" WHERE cubo_id = $1', [req.query.cubo_id], function (err, result) {
        if (err)
            return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString()}));
        else {
            if (result.rows.length === 0) {
                return res.status(404).send(JSON.stringify({'success':'false', 'err':'cubo_id doesnt exist'}));
            } else {
                cuboid = result.rows[0]
                if (req.session.username != cuboid.created_by)
                    return res.status(500).send(JSON.stringify({'success':'false', 'err':'Insufficient permission'}))
                pool.query('DELETE FROM "s_cuboid" WHERE cubo_id=$1', [req.query.cubo_id], function (err, result) {
                    if (err)
                        return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString()}))
                    else
                        res.send(JSON.stringify({ 'success': 'true'}));
                });
            }
        }
    });        
});

app.get('/listAll', function(req, res) {
    if(checkPermission(req,'staff')){
        pool.query('SELECT * from "s_cuboid"', function(err, result){
            if(err)
                return res.status(500).send(JSON.stringify({'success':'false','err':err.toString()}))
            else{
                return res.status(200).send(JSON.stringify({'success':'true','data':result.rows}))
            }
        })
    } else {
        pool.query('SELECT cubo_id, length, breadth, height, area, volume from "s_cuboid"', function (err, result) {
            if (err)
                return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString() }))
            else {
                return res.status(200).send(JSON.stringify({ 'success': 'true', 'data': result.rows }))
            }
        })
    }
});

app.get('/listMine', function(req, res) {
    if(!checkPermission(req,'staff'))
        return res.status(404).send(JSON.stringify({ 'success': 'false', 'err': 'Insufficient permission'}))
    pool.query('SELECT * from "s_cuboid" WHERE created_by=$1',[req.session.username],function(err, result){
        if(err)
            return res.status(500).send(JSON.stringify({ 'success': 'false', 'err': err.toString()}))
        else{
            return res.status(200).send(JSON.stringify({ 'success': 'true', 'data': result.rows }))
        }
    })
});

var port = process.env.PORT || 8181;
app.listen(port, function () {
    console.log(`DB details : ` + config.user, config.host, config.port);
    console.log(`API listening on port ${port}!`);
});