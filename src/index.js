import express from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient,ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db = null;
mongoClient.connect().then(()=>{
    db = mongoClient.db("test");
    setInterval(excludingUser,15000);
}).catch((error)=>{
    console.log(error);
});

//post usuário
app.post("/participants",async(req,res)=>{
    const validation = validatingData(
        {name: joi.string().required()},
        req.body
    );
    if (validation.error) {
        res.status(422).send(validation.error.details.map(
            detail=>detail.message
        ));
        return;
    }
    try{
        const { name } = validation.value;
        const collection = db.collection("participants");
        const alreadyExist = await collection.findOne({
            name:name
        });
		if (alreadyExist) {
            res.status(409).send("Usuário já existente");
			return;
		}
        await collection.insertOne({
            name:name,
            lastStatus: Date.now()
        });
        statusMensage(name,"entra na sala...");
        res.sendStatus(201);
    }catch(error){
        res.status(500).send(error);
    }
});

//get usuários
app.get("/participants",async(req,res)=>{
    try{
        const collection = db.collection("participants");
        //buscando lista de participantes
        const participants = await collection.find().toArray();
        res.send(participants);
    }catch(error){
        res.status(500).send(error);
    }
});

//post mensagens
app.post("/messages",async(req,res)=>{
    let {user:from}= req.headers;
    const validation = validatingData({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message","private_message").required()
    },req.body);
    if (validation.error) {
        res.status(422).send(validation.error.details.map(
            detail=>detail.message
        ));
        return;
    }
    try{
        let collection = db.collection("participants");
        from = await collection.findOne({name:from});
        if(from===null){
            res.status(422).send("O remetente não está cadastrado");
            return;
        }
        collection = db.collection("messages");
        await collection.insertOne({
            ...validation.value, 
            from:from.name,
            time:dayjs().format("HH:mm:ss")
        });
        res.sendStatus(201);
    }catch(error){
        res.status(500).send(error);
    }

});
app.get("/messages",async(req,res)=>{
    const {user:userName} = req.headers;
    let limit = req.query.limit;
    try{
        let collection = db.collection("messages");
        const messages = await collection.find().toArray();
        const userMessages = messages.filter(message=>{
            const{type,to,from}=message;
            if(type==="message"||type==="status"|| to===userName ||from===userName){
                return true;
            }
            return false;
        });
        if(limit===undefined){
            res.status(200).send(userMessages);
            return;
        }
        const length = userMessages.length;
        res.status(200).send(userMessages.slice(length-limit,length));
    }catch(error){
        res.status(500).send(error);
    }
});
app.post("/status",async(req,res)=>{
    const {user:userName}=req.headers;
    try{
        const collection = db.collection("participants");
        const status = await collection.findOne({name:userName});
        if(!status){
            res.sendStatus(404);
            return;
        }else{
            await collection.updateOne({name: status.name},{$set:{
                    lastStatus: Date.now()
            }});
            res.sendStatus(200);
        }
    }catch(error){
        res.status(500).send(error);
    }
});
app.delete("/messages/:id",async(req,res)=>{
    const {id} = req.params;
    const{user:from} = req.headers;
    const objectID = {_id:new ObjectId(id)};
    try{
        const collection = db.collection("messages");
        const message = await collection.findOne(objectID);
        if(!message){
            res.sendStatus(404);
            return;
        }
        if(message.from!==from){
            res.sendStatus(401);
            return;
        }
        await collection.deleteOne(objectID);
        res.sendStatus(200);
    }catch(error){
        res.status(500).send(error);
    }
});
app.put("/messages/:id",async(req,res)=>{
    const {id} = req.params;
    let{user:from} = req.headers;
    const objectID = {_id:new ObjectId(id)};
    const validation = validatingData({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message","private_message").required()
    },req.body);
    if (validation.error) {
        res.status(422).send(validation.error.details.map(
            detail=>detail.message
        ));
        return;
    }
    try{
        const collection = db.collection("messages");
        const message = await collection.findOne(objectID);
        if(!message){
            res.sendStatus(404);
            return;
        }
        if(message.from!==from){
            res.sendStatus(401);
            return;
        }
        from = await db.collection("participants").findOne({name:from});
        if(from===null){
            res.status(422).send("O remetente não está cadastrado");
            return;
        }
        await collection.updateOne(objectID,{$set:{
            to: req.body.to,
            text: req.body.text,
            type: req.body.type
        }});
        res.sendStatus(200);
    }catch(error){
        res.status(500).send(error);
    }
});
function statusMensage(from,text){
    const collection = db.collection("messages");
    collection.insertOne({
        from: from,
        to: "Todos",
        text: text,
        type: "status",
        time: dayjs().format("HH:mm:ss")
    });
}

function validatingData(joiObject,body){
    const Schema = joi.object(joiObject);
    const validation = Schema.validate(body,{ abortEarly: false});
    return validation;
}
async function excludingUser(){
    try{
        const collection = db.collection("participants");
        const users = await collection.find().toArray();
        const currentTime= Date.now();
        if(users){
            users.forEach(async (user) => {
                if(currentTime-user.lastStatus>10000){
                    await collection.deleteOne({name:user.name});
                    statusMensage(user.name,"sai da sala...");
                }
            });
        }
    }catch(error){
        console.log(error);
    }
}
const port = process.env.PORT || 5000;
app.listen(port,()=>{
    console.log(chalk.green("servidor ok"));
});