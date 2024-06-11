const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()

app.use(express.json())

let db = null

const dbpath = path.join(__dirname, 'twitterClone.db')

const intialize = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server started')
    })
  } catch (e) {
    console.log(`${e.message}`)
  }
}
intialize()

const gettingfollowing = async username => {
  const gettingfollowingquery = `select following_user_id from user inner join follower on user.user_id=follower.user_id where user.username="${username}";`
  const gettingfollowingresult = await db.all(gettingfollowingquery)
  const arrayofIds = gettingfollowingresult.map(
    eachmember => eachmember.following_user_id,
  )
  return arrayofIds
}

const authenticate = (request, response, next) => {
  const authheader = request.headers['authorization']
  let jwtToken
  if (authheader !== undefined) {
    jwtToken = authheader.split(' ')[1]
  } 
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'kimetsunoyaiba', (error, payload) => {
      if (error) {
        response.status(401)
        response.send(`Invalid JWT Token`)
      } else {
        request.username = payload.username
        request.userId = payload.userId
        next()
      }
    })
  }
}

const tweetaccess = async (request, response, next) => {
  const {tweetId} = request.params
  const {userId} = request
  const tweeting = `select  * from tweet inner join follower on tweet.user_id=follower.following_user_id where tweet.tweet_id="${tweetId}" and
  follower.follower_user_id="${userId}";`
  const tweetingresult = await db.get(tweeting)
  if (tweetingresult === undefined) {
    response.status(401)
    response.send(`Invalid Request`)
  } else {
    next()
  }
}


app.post('/register/', async (response, request) => {
  const body1 = request.body
  const {username, password, gender, name} = body1
  const getquery1 = `select * from user where username="${username}";`
  const checking = await db.get(getquery1)
  if (checking !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send(`Password is too short`)
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const dbquery1 = `insert into user (name,username,password,gender) values (
                "${name}","${username}","${hashedPassword}","${gender}"
            );`
      const result1 = await db.run(dbquery1)
      response.status(200)
      response.send(`User created successfully`)
    }
  }
})

app.post('/login/', async (request, response) => {
  const body2 = request.body
  const {username, password} = body2
  const getquery2 = `select * from user where username="${username}";`
  const check2 = await db.get(getquery2)
  if (result2 === undefined) {
    response.status(400)
    response.send(`Invalid user`)
  } else {
    const passwordcheck = await bcrypt.compare(password, check2.password)
    if (passwordcheck) {
      const payload = {username, userId: check2.user_id}
      const jwtToken = jwt.sign(payload, 'kimetsunoyaiba')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send(`Invalid password`)
    }
  }
})


app.get('/user/tweets/feed/', authenticate, async (request, response) => {
  const {username} = request
  const ids = await gettingfollowing(username)
  const dbquery3 = `select username,tweet,date_time as dateTime from user inner join tweet on user.user_id= tweet.user_id where user.user_id in (${ids}) order by date_time desc limit 4 ;`
  const result3 = await db.all(dbquery3)
  response.send(result3)
})

app.get('/user/following/', authenticate, async (request, response) => {
  const {username, userId} = request
  const dbquery4 = `select name from user inner join follower on user.user_id=follower.following_user_id where follower_user_id="${userId}"; `
  const result4 = await db.all(dbquery4)
  response.send(result4)
})

app.get('/user/followers/', authenticate, async (request, response) => {
  const {username, userId} = request
  const dbquery5 = `select  distinct name from user inner join follower on user.user_id=follower.follower_user_id where following_user_id="${userId}"; `
  const result5 = await db.all(dbquery5)
  response.send(result5)
})



app.get(
  '/tweets/:tweetId/',
  authenticate,
  tweetaccess,
  async (request, response) => {
    const {userId, username} = request
    const {tweetId} = request.params
    const dbquery6 = ` select tweet,(select count() from like where tweet_id="${tweetId}") as likes,
    (select count() from reply where tweet_id="${tweetId}") as replies,date_time as dateTime from tweet where tweet.tweet_id="${tweetId}";`
    const result6 = await db.get(dbquery6)
    response.send(result6)
  },
)

app.get(
  '/tweets/:tweetId/likes/',
  authenticate,
  tweetaccess,
  async (request, response) => {
    const {tweetId} = request.params
    const dbquery7 = `select username from user inner join like on user.user_id=like.user_id where tweet_id="${tweetId}";`

    const result7 = await db.all(dbquery7)
    const userarray=result7.map((each)=>each.username)
    response.send({likes:userarray});
  },
)

app.get(
  '/tweets/:tweetId/replies/',
  authenticate,
  tweetaccess,
  async (request, response) => {
    const {tweetId} = request.params
    const dbquery8 = `select name,reply from user inner join reply on user.user_id=reply.user_id where tweet_id="${tweetId}";`

    const result8 = await db.all(dbquery8)
    response.send({replies:result8})
  }
)

app.get("/users/tweets/", async (request,response)=>{
  const{userId}=request;
  const dbquery9=`select tweet,count(distinct like_id) as likes, count (distinct reply_id) as replies, date_time as dateTime
  from tweet left join reply on tweet.tweet_id=reply.tweet_id left join like on tweet.tweet_id=like.tweet_id ; where tweet.user_id="${userId}"
  group by tweet.tweet_id;`;
  const result9=await db.all(dbquery9);
  response.send(result9)
})

app.post("/user/tweets/",authenticate,async (request,response)=>{
  const {tweet}=request.body;
  const userId = parseInt(request.userId);
  const dateTime=new Date().toJSON().substring(0,19).replace("T", " ");
  const dbquery10=`insert into tweet (tweet,user_id,date_time) values (
    "${tweet}","${userId}","${dateTime}"
  );`;
  const result10=await db.run(dbquery10);
  response.send("Created a Tweet");
})

app.delete("/tweets/:tweetId/",authenticate,async (request,response)=>{
  const parameter11=request.params;
  const {userId}=request;
  const {tweetId}=parameter11;
  const getquery3=`select * from tweet where user_id="${userId}" and tweet_id="${tweetId}";`;
  const getting= await db.get(getquery3);
  console.log(getting);
  if(getting===undefined){
    response.status(400);
    response.send(`Invalid Request`);
  }else{
      const dbquery11=`delete from tweet where tweet_id="${tweetId}";`;
      const result11= await db.run(dbquery11);
      response.send("Tweet Removed");
  }
})

module.exports = app
