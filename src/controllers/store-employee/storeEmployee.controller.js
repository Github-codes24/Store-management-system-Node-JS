import env from "../../config/env.js"
import StoreEmployee from "../../models/storeEmployee.model.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
export async function register(req, res) {
    try {
        
        const {email, password, phone, designation, name, storeId, address} = req.body


        if(!email || !password || !phone || !designation || !name || !storeId){
            return res.status(400).json({message: "All fields are required"})
        }


        const employeeExist = await StoreEmployee.findOne({email})
        
        if(employeeExist){
            return res.status(400).json({message: "Employee already exists"})
        }


        const passHash = await bcrypt.hash(password, 10)
        
        const newEmployee = new StoreEmployee({
            name,
            email,
            password: passHash,
            phone,
            designation,
            status: "active",
            address,
            storeId,
            profileImage: ""
        })

        await newEmployee.save()
        

        return res.status(201).json({message: "Employee registered successfully", employee: newEmployee})


    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "Internal server error"})
    }
}

export async function login(req, res){
    try {
        
        const {username,email, password} = req.body

        if ((!username && !email) || !password) {
            return res.status(400).json({message: "Please provide username or email and password"})
        }
         
        const queryConditions = [];
        if (email) queryConditions.push({ email: email.toLowerCase().trim() });
        if (username) queryConditions.push({ username: username.toLowerCase().trim() });

        const employeeExist = await StoreEmployee.findOne({
            $or: queryConditions
        }).populate("storeId");

        if(!employeeExist){
            return res.status(404).json({message: "Invalid Credentials"})
        }

        const isPasswordMatch = await bcrypt.compare(password, employeeExist.password)

        if(!isPasswordMatch){
            return res.status(401).json({message: "Invalid Credentials"})
        }

        const token = jwt.sign({id: employeeExist._id}, env.STORE_EMPLOYEE_JWT_SECRET, {expiresIn: env.STORE_EMPLOYEE_JWT_EXPIRES_IN})
  
        res.cookie("empoyeeToken", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000
        })
        
        return res.status(200).json({message: "Employee logged in successfully", data:{
               employee: employeeExist,
               token
        }})

    } catch (error) {
        console.log(error)
        return res.status(500).json({message: "Internal server error"})
    }
}

