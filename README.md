# restful_crud

A basic RESTful CRUD API using Node.JS and Postgres



### API Reference

```
/createUser POST    JSON body     {"username":"u1","password","p","role":"staff"}
/login      POST    JSON body     {"username":"u1", "password":"p"}
/add        POST    Query params  ?length=5&breadth=6&height=7
/update     POST    Query params  ?cubo_id=2&length=10
/delete     DELETE  Query params  ?cubo_id=2
/listAll    GET     Query params  ?filterVar=4&val=120
/listMine   GET     Query params  ?filterVar=6&val=user1


JSON Responses
{'success':'true/false', 'err':'if any', 'data':data}
```

### ToDo
- Write better readme
  - how to run the code for eg could be added 
