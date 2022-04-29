import express from "express";
import cors from "cors";
import chalk from 'chalk';
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";

dotenv.config();

const app = express();
const mongoClient = new MongoClient(process.env.MONGO_URI);

app.use(cors());
app.use(express.json());

async function connectingDB(collection){
    try{
        const promisse = mongoClient.connect();
	    const db = mongoClient.db("test");
        return db.collection(collection);
    }catch(error){
        res.status(500).send(error);
    }
}

//post usuário
app.post("/participants",async(req,res)=>{
    const Schema = joi.object({name: joi.string().required()});
    //verificando nome
    const validation = Schema.validate(req.body,{ abortEarly: true });
    if (validation.error) {
        res.status(422).send(validation.error.details);
        return;
    }
    try{
        const { name } = req.body;
        //conectando servidor
        const collection = await connectingDB("participants");
        //verificando existência do userName
        const alreadyExist = await collection.findOne({
            name:name
        })
		if (alreadyExist) {
            res.status(409).send("Usuário já existente");
			mongoClient.close();
			return;
		}
        //inserindo usuário válido no db
        await collection.insertOne({
            name:name,
            lastStatus: Date.now()
        });
        res.sendStatus(201);
    }catch(error){
        res.status(500).send(error);
    }finally{
        console.log(chalk.blue("mongoClient desconectado"));
        mongoClient.close();
    }
});

//get usuários
app.get("/participants",async(req,res)=>{
    try{
        //conectando servidor
        const collection = await connectingDB("participants");
        //buscando lista de participantes
        const participants = await collection.find().toArray();
        res.send(participants);
    }catch(error){
        res.status(500).send(error);
    }finally{
        console.log(chalk.blue("mongoClient desconectado"));
        mongoClient.close();
    }
});

const port = process.env.PORT || 5000;
app.listen(port,()=>{
    console.log(chalk.green("servidor ok"));
});