const express = require('express');
const app = express();
var bodyParser = require('body-parser');
var mysql      = require('mysql');
var PHPUnserialize = require('php-unserialize');
const Serialize = require('php-serialize');
var auth = require('basic-auth');
var http = require('http');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.listen(8080, function () {
    console.log('Node app is running on port 8080');
});

const mc = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'etna-rest',
    multipleStatements: true
})

mc.connect();

app.get('/api/recipes.:extension', function(req, res) {
	get_filtre = req.query.name;

	if (get_filtre == undefined) {
		mc.query('SELECT id, name, slug FROM recipes__recipe', function (error, results, fields) {
			if (req.params.extension != 'json'){
				var retour = {code: 400, message: 'error', datas: ['default extension']};
				var code = 400;
			}
			else{
				var retour = {code: 200, message: 'OK', datas: results};
				var code = 200;
			}
		res.json(retour, code);
		});
	}	
	else {
		mc.query("SELECT id, name, slug FROM recipes__recipe WHERE name LIKE '%"+get_filtre+"%'", function(error, results, fields) {
			if (req.params.extension != 'json'){
				var retour = {code: 400, message: 'error', datas: ['default extension']};
				var code = 400;
			}
			else{
				if (results.length == 0) {
					var retour = {code: 400, message: 'error', datas: ['prameter does not exist']};
					var code = 400;					
				}
				else {
					var retour = {code: 200, message: 'OK', datas: results};
					var code = 200;
				}
			}
		res.json(retour, code);			
		});
	}
})

app.get('/api/recipes/:slugname.:extension', function(req, res) {
	var password = req.headers.authorization;
	var get_slug = req.params.slugname;

	mc.query("SELECT recipe.id, recipe.name, recipe.slug, user.username, user.password, user.last_login, recipe.user_id, user.email FROM recipes__recipe recipe INNER JOIN users__user user WHERE user.id=recipe.user_id AND recipe.slug='"+get_slug+"' AND user.password='"+password+"'", function (error, results, fields) {
		if (results == undefined || results.length == 0) {
			mc.query("SELECT recipe.id, recipe.name, user.username, user.last_login, recipe.user_id, recipe.slug FROM recipes__recipe recipe INNER JOIN users__user user WHERE user.id=recipe.user_id AND recipe.slug="+"'"+get_slug+"'", function (error, results, fields) {
				if (results.length == 0) {
					var retour = {code: 404, message: 'not found'};
					res.send(retour, 404);		
				}
				else {
					results[0].user = {
						username : results[0].username,
						last_login : results[0].last_login,
						id : results[0].user_id
					}

					var keep_slug = results[0].slug;
					delete results[0].username;
					delete results[0].last_login;
					delete results[0].user_id;
					delete results[0].slug;
					results[0].slug = keep_slug;

					var retour = {code: 200, message: 'OK', datas: results[0]};
					var code = 200;
					res.json(retour, code);
				}
			});
		}
		else {	
			var retour = {code: 200, message: "OK", datas: {id: results[0].id, name:results[0].name, user:{username: results[0].username, last_login: results[0].last_login, id: results[0].user_id, email: results[0].email}, slug: results[0].slug}}
			var code = 200;
			res.json(retour, code);
		}
	});
});

app.get('/api/recipes/:slugname/steps.:extension', function(req, res) {
	var name = req.params.slugname;
	mc.query("SELECT * FROM recipes__recipe WHERE slug="+"'"+name+"'", function (error, results, fields) {
		results = results[0];
	if (req.params.extension != 'json'){
		var retour = {code: 400, message: 'Bad Request', datas: ['default extension']};
		var code = 400;
	}
	else if (results == undefined) {
		var retour = {code: 404, message: 'not found'};
		res.send(retour, 404);		
	}
	else if (results.step == "undefined") {
		results.step = [];
		var results = results.step;
		var retour = {code: 200, message: 'OK', datas: results};
		var code = 200;
	}	
	else{
		if (error) throw error;
		results = PHPUnserialize.unserialize(results.step);
		var results = Object.values(results);
		var retour = {code: 200, message: 'OK', datas: results};
		var code = 200;
	}
	res.json(retour, code);
	});
})

app.post('/api/recipes.:extension', function(req, res) {
	var post_result = req.body;
	var password = req.headers.authorization;	

	mc.query("SELECT id, username, last_login FROM users__user WHERE password='"+password+"'; SELECT slug FROM recipes__recipe WHERE slug='"+post_result.slug+"'", function (error, results, fields) {
		var user_result = results[0];
		var recipe_result = results[1];
	
		if (user_result.length == 0) {		
			var retour = {code: 401, message: 'Unauthorized'};
			var code = 401;
			res.json(retour, code);   		
  		} 
  		else if (recipe_result.length == 1) {
			var retour = {code: 400, message: 'Bad Request', datas: ['slug already exist']};
			var code = 400;
			res.json(retour, code);
		}
  		else {		
	  		if (post_result.name == undefined || post_result.name.length == 0) {
				var retour = {code: 400, message: 'Bad Request', datas: ['name undefined']};
				var code = 400;
				res.json(retour, code); 			
	  		} 	
	  		else {
		  		if (post_result.slug == undefined || post_result.slug.length == 0) {
					var nb = Math.round(Math.random() * 100 - 0.5);			
					var nb2 = Math.round(Math.random() * 100 - 0.5);
					var newSlug = post_result.name.substr(-20, 4);
					post_result.slug = newSlug+"-"+nb+nb2;
				}				
				if (post_result.step == undefined || post_result.step.length == 0) {
					post_result.step2 = [];			
				} 
				else {					
					post_result.step2 = Serialize.serialize(post_result.step);	
				}
				var result = {};
				var sql = "INSERT INTO recipes__recipe (user_id, name, slug, step) VALUES ('"+user_result[0].id+"', '"+post_result.name+"', '"+post_result.slug+"', '"+post_result.step2+"')";
				insertSql(sql, function(err, data){
					if(err) throw err;
					result.id = data.insertId;
					result.name = post_result.name;
					result.user = {
						username : user_result[0].username,
						last_login : user_result[0].last_login,
						id : user_result[0].id
					}
					result.slug = post_result.slug;
					result.step = post_result.step;
					var retour = {code: 201, message: 'Created', datas: result};
	    			var code = 201;
	    			res.json(retour, code);
				});
	  		}
  		}		
	});	
})

app.put('/api/recipes/:slugname.:extension', function(req, res) {
	var password = req.headers.authorization;	
	mc.query("SELECT username FROM users__user WHERE password='"+password+"'", function (error, results, fields) {
		var url_slug = req.body.slug;
		if (password == undefined || results.length == 0) {
			var retour = {code: 401, message: 'Unauthorized'};
			var code = 401;			
			res.json(retour, code);
		}
		else {	
			var slug = req.params.slugname;
			mc.query("SELECT recipe.id, recipe.name, user.username, user.password, user.last_login, recipe.user_id, recipe.step, recipe.slug FROM recipes__recipe recipe INNER JOIN users__user user WHERE user.id=recipe.user_id AND recipe.slug='"+slug+"'; SELECT slug FROM recipes__recipe WHERE slug='"+url_slug+"'", function (error, results, fields) {
				if (results[0].length == 0) {
					var retour = {code: 404, message: 'not found'};
					res.send(retour, 404);		
				} 	
				else {
					var password2 = results[0][0].password;
					if (password == password2) {
						if (results[0].length == 0) {
							var retour = {code: 404, message: 'not found'};
							res.send(retour, 404);		
						} 	
						else {
							var reg = /[&~"#'{(\[|`_\\^@)\]=}+*\/,;.:§!%$£¤µ€]/;
							var reg2 = /[&~"#'{(\[|`_\\^@)\]=}+*\/;.:§!%$£¤µ€]/;

							var put_name = req.body.name;
							var put_slug = req.body.slug;
							var put_step = req.body.step;

							if (reg.test(put_name) || reg.test(put_slug) || reg2.test(put_step))  {
								var retour = {code: 400, message: 'Bad Request', datas: ['unauthorized characters']};
								var code = 400;
							}
							else {
						
								if (put_name == undefined || put_name.length == 0) {
									put_name = undefined;
								}
								if (put_slug == undefined || put_slug.length == 0) {
									put_slug = undefined;
								}
								if (put_step == undefined || put_step[0].length == 0) {
									put_step = undefined;
								}

								if (put_name == undefined) {
									var retour = {code: 400, message: 'Bad Request', datas: ['name is empty']};
									var code = 400;			
								} 
								else {
									if (put_slug == undefined) {
										mc.query("UPDATE recipes__recipe SET name='"+put_name+"' WHERE slug='"+slug+"'");									
										if (put_step == undefined) {
											put_step = results[0][0].step;
											put_step = PHPUnserialize.unserialize(put_step);
											var put_step = Object.values(put_step);										
										} else {
											put_step2 = Serialize.serialize(put_step);
											mc.query("UPDATE recipes__recipe SET step='"+put_step2+"' WHERE slug='"+slug+"'");
										}
										var retour = {code: 200, message: 'OK', datas: {id: results[0][0].id, name: put_name, user: {username: results[0][0].username, last_login: results[0][0].last_login, id: results[0][0].user_id}, slug: results[0][0].slug, step: put_step}};
										var code = 200;		
									}
									else if (put_slug != undefined) {							
										if (put_step == undefined) {
											put_step = results[0][0].step;
											put_step = PHPUnserialize.unserialize(put_step);
											var put_step = Object.values(put_step);										
										} else {
											put_step2 = Serialize.serialize(put_step);
											mc.query("UPDATE recipes__recipe SET step='"+put_step2+"' WHERE slug='"+slug+"'");
										}
										mc.query("UPDATE recipes__recipe SET name='"+put_name+"' WHERE slug='"+slug+"'");
										mc.query("UPDATE recipes__recipe SET slug='"+put_slug+"' WHERE slug='"+slug+"'");
										var retour = {code: 200, message: 'OK', datas: {id: results[0][0].id, name: put_name, user: {username: results[0][0].username, last_login: results[0][0].last_login, id: results[0][0].user_id}, slug: put_slug, step: put_step}}
										var code = 200;		
									}
									else if (put_step != undefined) {
										put_step2 = Serialize.serialize(put_step);
										mc.query("UPDATE recipes__recipe SET step='"+put_step2+"' WHERE slug='"+slug+"'");
										var retour = {code: 200, message: 'OK', datas: {id: results[0][0].id, name: results[0][0].name, user: {username: results[0][0].username, last_login: results[0][0].last_login, id: results[0][0].user_id}, slug: results[0][0].slug, step: put_step}}
										var code = 200;											
									}
								}
							}								
						}			
					}
					else {
						var retour = {code: 403, message: 'Forbidden'};
						var code = 403;						
					}
				}
				res.json(retour, code);
			});			
		}		
	});
});

app.delete('/api/recipes/:slugname.:extension', function(req, res) {
	var password = req.headers.authorization;
	mc.query("SELECT username FROM users__user WHERE password ='"+password+"'", function (error, results, fields) {
		var url_slug = req.body.slug;
		if (password == undefined || results.length == 0) {
			var retour = {code: 401, message: 'Unauthorized'};
			var code = 401;
			res.json(retour, 401);
		}
		else {
			var slug = req.params.slugname;
			mc.query("SELECT recipe.id, user.password FROM recipes__recipe recipe INNER JOIN users__user user WHERE user.id=recipe.user_id AND recipe.slug='"+slug+"'", function(error, results, fields) {
				if (results.length == 0) {
					var retour = {code: 404, message: 'not found'};
					res.send(retour, 404);						
				}
				else {
					var password2 = results[0].password;
					if (password == password2) {
						if (results[0].length == 0) {
							var retour = {code: 404, message: 'not found'};
							res.send(retour, 404);									
						}
						else {
							mc.query("DELETE FROM recipes__recipe WHERE id ='"+results[0].id+"'")
							var retour = {code: 200, message: 'succes', datas: {id: results[0].id}};
							res.send(retour,200);
						}
					}
					else {
						var retour = {code: 403, message: 'Forbidden'};
						var code = 403;						
					}
				}
			res.json(retour, code);
			});
		}
	});
}); 

app.all('*', function(req, res){
	var retour = {code: 404, message: 'not found'};
	res.send(retour, 404);
});


function insertSql(sql, callback){
    mc.query(sql, function(error, results, fields) {
      	if(error){
        	return callback(error);
      	}else{
      		return callback(error, results);
      	}
    });
}