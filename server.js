
const fs = require("fs")
const express = require("express")
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use('/assets', express.static('assets'))
app.get('/', async (req, res) => {
    fs.readFile("client.html", function(er, data){
        res.end(data)
    })
})
app.get('/piss', async (req, res) => {
    fs.readFile("piss.html", function(er, data){
        res.end(data)
    })
})
app.get('/filelist', async (req, res) => {
    try {
        const files = await fs.promises.readdir("assets");
        res.status(200).json(files);
    } catch (err) {
        res.status(500).json(err);
    }

});

players=[]
tanksize=[60,60]
turretlen=Math.sqrt((tanksize[0]/2)**2+(tanksize[1]/2)**2)
targetframerate=15
framerate=15
const map = require("./map.json")
console.log(map)
walls=[]

for (i=0; i<(map.length/2); i++){
    for(j=0; j<map[i*2].length;j++){
        if(map[i*2][j]){
            walls.push([80+160*j, 160*i,20,160])
        }
    }
}

for (i=0; i<(map.length/2-1); i++){
    for(j=0; j<map[i*2+1].length;j++){
        if(map[i*2+1][j]){
            walls.push([160*j, 80+160*i,160,20])
        }
    }
}

mapheight=(map.length-1)/2
mapwidth=(map[0].length)
console.log(mapwidth+" "+mapheight)
projectiles=[]
packet={}
packet.size=[30,30]
packet.effects=["shield", "laser", "shotgun", "reload", "invis", "speed", "chill", "revive"]
packet.durations=[7000, 1, 1, 10000, 7000, 10000, 5000, 1]
packets=[]

function checkPoint(point, rect){
    
    let sides = [[0,0,0],[0,0,0]]
    let s = [0,0]
    let dist=0
    let mindist=1000
    let minside=[0,0]
    let triangles=[[[0,1],[2,3]],[[0,3],[2,1]]]
    for (let i = 0; i<triangles.length; i++){
        sides[0][0]=distance(rect[triangles[i][0][0]][0], rect[triangles[i][0][0]][1], rect[triangles[i][0][1]][0], rect[triangles[i][0][1]][1])
        sides[0][1]=distance(rect[triangles[i][0][0]][0], rect[triangles[i][0][0]][1], point[0], point[1])
        sides[0][2]=distance(rect[triangles[i][0][1]][0], rect[triangles[i][0][1]][1], point[0], point[1])
        s[0]=(sides[0][0]+sides[0][1]+sides[0][2])/2
        sides[1][0]=distance(rect[triangles[i][1][0]][0], rect[triangles[i][1][0]][1], rect[triangles[i][1][1]][0], rect[triangles[i][1][1]][1])
        sides[1][1]=distance(rect[triangles[i][1][0]][0], rect[triangles[i][1][0]][1], point[0], point[1])
        sides[1][2]=distance(rect[triangles[i][1][1]][0], rect[triangles[i][1][1]][1], point[0], point[1])
        s[1]=(sides[1][0]+sides[1][1]+sides[1][2])/2
        dist=distance(rect[triangles[i][0][0]][0], rect[triangles[i][0][0]][1], rect[triangles[i][1][1]][0], rect[triangles[i][1][1]][1])
        if((dist < (2 / sides[0][0] * Math.sqrt(s[0] * (s[0]-sides[0][0]) * (s[0]-sides[0][1]) * (s[0]-sides[0][2])))) || (dist < (2 / sides[1][0] * Math.sqrt(s[1] * (s[1]-sides[1][0]) * (s[1]-sides[1][1]) * (s[1]-sides[1][2]))))){
            return(false)
        }
        
    }
    
    return(true) 

}

function distance(x1,y1,x2,y2){
    return(Math.sqrt(((x2-x1)**2)+((y2-y1)**2)))
}

function getPoints(x,y,w,h,rot){
    let r = Math.sqrt((w/2)**2+(h/2)**2)
    let alpha = Math.acos(h/(2*r))
    let x1 = r*Math.cos(rot+alpha)
    let y1 = r*Math.sin(rot+alpha)
    let x2 = r*Math.cos(rot-alpha)
    let y2 = r*Math.sin(rot-alpha)
    return([[x-x1, y+y1],[x+x2, y-y2],[x+x1, y-y1],[x-x2, y+y2]])
}

counter=0
time=new Date()
tajm=time.getTime()
async function mainLoop(){
    
    let positions={"tanks":[], "projectiles":[], "packs":[]}
    let debugpos = []
    let delplayers=[]
    try{
        let time=new Date()
        if(Math.random()*700<framerate){

            let type=Math.floor(Math.random()*packet.effects.length)
            let newpack=[80+Math.floor(Math.random()*mapwidth)*160, 80+Math.floor(Math.random()*mapheight)*160, packet.effects[type], packet.durations[type]]
            let isnew=true
            for(let i =0; i<packets.length; i++){
                if(newpack[0]==packets[i][0] && newpack[1]==packets[i][1]){
                    isnew=false
                    break
                }
            }
            if(isnew){
                packets.push(newpack)
                console.log("Packet spawn")
                console.log(packets[packets.length-1])
            }
        }
        
        for(let i=0; i<players.length; i++){
            if(players[i].effects.shield){
                players[i].effects.shield-=framerate
                if(players[i].effects.shield<0){
                    players[i].effects.shield=0
                    players[i].coords[5]=0
                }
            }else if(players[i].effects.reload){
                players[i].effects.reload-=framerate
                if(players[i].effects.reload<0){
                    players[i].effects.reload=0
                }
            }else if(players[i].effects.speed){
                players[i].effects.speed-=framerate
                if(players[i].effects.speed<0){
                    players[i].effects.speed=0
                }
            }else if(players[i].effects.invis){
                players[i].effects.invis-=framerate
                if(players[i].effects.invis<0){
                    players[i].effects.invis=0
                }
            }else if(players[i].effects.chill){
                players[i].effects.chill-=framerate
                if(players[i].effects.chill<0){
                    players[i].effects.chill=0
                }
            }else if(players[i].effects.reviving){
                players[i].effects.reviving-=framerate
                if(players[i].effects.reviving<=0){
                    players[i].effects.reviving=0
                    players[i].effects.shield=2000
                    players[i].coords[5]=1
                }
            }
            
            coordtest=[...players[i].coords]
            if(!players[i].effects.chill && !players[i].effects.reviving){
                coordtest[2]+=0.04/20*framerate**players[i].left
                coordtest[2]-=0.04/20*framerate**players[i].right
                coordtest[0]+=5/20*framerate*players[i].forward*Math.cos(players[i].coords[2])
                coordtest[1]-=5/20*framerate*players[i].forward*Math.sin(players[i].coords[2])
                coordtest[0]-=5/40*framerate*players[i].backward*Math.cos(players[i].coords[2])
                coordtest[1]+=5/40*framerate*players[i].backward*Math.sin(players[i].coords[2])
                if(players[i].effects.speed){
                    coordtest[2]+=0.04/20*framerate**players[i].left
                    coordtest[2]-=0.04/20*framerate**players[i].right
                    coordtest[0]+=5/20*framerate*players[i].forward*Math.cos(players[i].coords[2])
                    coordtest[1]-=5/20*framerate*players[i].forward*Math.sin(players[i].coords[2])
                    coordtest[0]-=5/40*framerate*players[i].backward*Math.cos(players[i].coords[2])
                    coordtest[1]+=5/40*framerate*players[i].backward*Math.sin(players[i].coords[2])
                }
            }
            
            let points=getPoints(coordtest[0], coordtest[1], tanksize[0], tanksize[1], coordtest[2])
            debugpos=debugpos.concat(points)
            
            let collision = false
            
            for(let k=0; k<players.length; k++){
                if(k==i){
                    continue
                }
                if( ((coordtest[0]-players[k].coords[0])**2 + (coordtest[1]-players[k].coords[1])**2) < ((tanksize[0]**2 + tanksize[1]**2)*4)){
                    for(let j=0; j<4; j++){
                        if(checkPoint(points[j], getPoints(players[k].coords[0],players[k].coords[1],tanksize[0],tanksize[1],players[k].coords[2]))){
                            if(players[k].effects.speed!=0){
                                players[i].removeAllListeners()
                                players[i].emit("playSound","gameover")
                                players[i].emit("spectator", "")
                                delplayers.push(i)
                            }
                            if(players[i].effects.speed!=0){
                                players[k].removeAllListeners()
                                players[k].emit("playSound","gameover")
                                players[k].emit("spectator", "")
                                delplayers.push(k)
                            }
                            collision=true
                            break
                        }
                        if(checkPoint(getPoints(players[k].coords[0],players[k].coords[1],tanksize[0],tanksize[1],players[k].coords[2])[j], points )){
                            if(players[k].effects.speed!=0){
                                players[i].removeAllListeners()
                                players[i].emit("playSound","gameover")
                                players[i].emit("spectator", "")
                                delplayers.push(i)
                            }
                            if(players[i].effects.speed!=0){
                                players[k].removeAllListeners()
                                players[k].emit("playSound","gameover")
                                players[k].emit("spectator", "")
                                delplayers.push(k)
                            }
                            collision=true
                            break
                        }
                    }
                }
                if(collision){
                    
                    break
                }
            }
                
            for(let k=0; k<walls.length; k++){
                if(collision){
                    break
                }
                if( ((coordtest[0]-walls[k][0])**2 + (coordtest[1]-walls[k][1])**2) < ((tanksize[0]+walls[k][2])**2 + (tanksize[1]+walls[k][3])**2)){
                    for(let j=0; j<4; j++){
                        debugpos=debugpos.concat(getPoints(walls[k][0],walls[k][1],walls[k][2],walls[k][3],0))
                        if(checkPoint(points[j], getPoints(walls[k][0],walls[k][1],walls[k][2],walls[k][3],0))){
                            
                            collision=true
                            break
                        }
                        if(checkPoint(getPoints(walls[k][0],walls[k][1],walls[k][2],walls[k][3],0)[j], points )){
                            
                            collision=true
                            break
                        }
                    }
                }
            } 
            if(!collision){
                
                players[i].coords=[...coordtest]
            }
            if(Math.abs(players[i].mouserot-players[i].coords[3])<0.1){
                players[i].coords[3]=players[i].mouserot
            }else{
                if(players[i].effects.reviving==0){
                    if(Math.abs(players[i].mouserot-players[i].coords[3])>Math.PI){
                        players[i].coords[3]-=0.06/20*framerate*Math.sign(players[i].mouserot-players[i].coords[3])
                    }else{
                        players[i].coords[3]+=0.06/20*framerate*Math.sign(players[i].mouserot-players[i].coords[3])
                    }
                    if(players[i].effects.speed){
                        if(Math.abs(players[i].mouserot-players[i].coords[3])>Math.PI){
                            players[i].coords[3]-=0.06/20*framerate*Math.sign(players[i].mouserot-players[i].coords[3])
                        }else{
                            players[i].coords[3]+=0.06/20*framerate*Math.sign(players[i].mouserot-players[i].coords[3])
                        }
                    }
                }
                
            }
            
            if(players[i].coords[3]<0){
                players[i].coords[3]+=2*Math.PI
            }else if (players[i].coords[3]>(2*Math.PI)){
                players[i].coords[3]-=2*Math.PI
            }
            if(!players[i].effects.invis){
                positions.tanks.push(players[i].coords)
				
            }
            
        }

        
        let delprojectiles=[]
        for(i=0; i<projectiles.length; i++){
            collision=false
            projectiles[i][0]+=(0.6+(0.7*projectiles[i][3]))*framerate*Math.cos(projectiles[i][2])
            projectiles[i][1]-=(0.6+(0.7*projectiles[i][3]))*framerate*Math.sin(projectiles[i][2])
            for(let k=0; k<walls.length; k++){
                if( ((projectiles[i][0]-walls[k][0])**2 + (projectiles[i][1]-walls[k][1])**2) < ((walls[k][2])**2 + (walls[k][3])**2)){
                    
                    debugpos=debugpos.concat(getPoints(walls[k][0],walls[k][1],walls[k][2],walls[k][3],0))
                    if(checkPoint(projectiles[i], getPoints(walls[k][0],walls[k][1],walls[k][2],walls[k][3],0))){
                        collision=true
                        break
                    }
                    
                }
            }
            for(let k=0; k<players.length; k++){
                if( ((projectiles[i][0]-players[k].coords[0])**2 + (projectiles[i][1]-players[k].coords[1])**2) < (tanksize[0]**2 + tanksize[1]**2)){
                    if(checkPoint(projectiles[i], getPoints(players[k].coords[0],players[k].coords[1],tanksize[0],tanksize[1],players[k].coords[2]))){
                        collision=true
                        console.log("HIT!!!")
                        if(!players[k].effects.shield){
                            if(players[k].effects.revive){
                                players[k].effects.reviving=1000
                                players[k].effects.revive=0
                            }else{
                                players[k].removeAllListeners()
                                players[k].emit("playSound","gameover")
                                players[k].emit("spectator", "")
                                delplayers.push(k)
                            }
                        }
                        break
                    }
                }
            }
            if (!collision){
                
                positions.projectiles.push(projectiles[i])
                
            }else{
                delprojectiles.push(i)
            }
        }
        delpackets=[]
        for(i=0; i<packets.length; i++){
            collision=false
            

            for(let k=0; k<players.length; k++){
                if( (!(players[k].effects.shield+players[k].effects.laser+players[k].effects.shotgun+players[k].effects.reload+players[k].effects.invis+players[k].effects.speed+players[k].effects.revive+players[k].effects.reviving))&&(((packets[i][0]-players[k].coords[0])**2 + (packets[i][1]-players[k].coords[1])**2) < (tanksize[0]*packet.size[0] + tanksize[1]*packet.size[1]))){
                    if(checkPoint([packets[i][0], packets[i][1]], getPoints(players[k].coords[0],players[k].coords[1],tanksize[0],tanksize[1],players[k].coords[2]))){
                        players[k].emit("playSound", "package")
                        if(packets[i][2]!="chill"){
							players[k].effects[packets[i][2]]=packets[i][3]
                            if(packets[i][2]=="shield"){
                                players[k].coords[5]=1
                            }
						}else{
							for(let l=0; l<players.length; l++){
								if(l!=k){
									players[l].effects[packets[i][2]]=packets[i][3]
								}
							}
						}
                        console.log("EFFECT GOT: "+packets[i][2])
                        
                        collision=true
                        break
                        
                    }
                }
            }
            if (!collision){
                
                positions.packs.push(packets[i])
                
            }else{
                delpackets.push(i)
            }
        }

        delpackets.sort((a,b)=>a-b)
        delpackets=delpackets.reverse()
        for(i=0; i<delpackets.length; i++){
            packets.splice(delpackets[i], 1)
        }
        delprojectiles.sort((a,b)=>a-b)
        delprojectiles=delprojectiles.reverse()
        for(i=0; i<delprojectiles.length; i++){
            projectiles.splice(delprojectiles[i], 1)
        }
        delplayers.sort((a,b)=>a-b)
        delplayers=delplayers.reverse()
        for(i=0; i<delplayers.length; i++){
            players.splice(delplayers[i], 1)
        }
        
        for(i=0; i<players.length; i++){
            await players[i].emit("positionUpdate", players[i].coords)
			time=new Date()
            players[i].effects.time = time.getTime()
            await players[i].emit("statusUpdate", players[i].effects)
        }
        
        
        await io.emit("frameUpdate", positions)
        //await io.emit("debugUpdate", debugpos)
    }catch(e){
        console.log("Skipped frame: "+e)
    }
    counter++
    if(counter%100==0){
        time=new Date()
        console.log(counter+" "+((time.getTime()-tajm)/100))
        framerate=((time.getTime()-tajm)/100)
        tajm=time.getTime()
    }

}

setInterval(mainLoop, targetframerate)



io.sockets.on("connection", (socket)=>{
    console.log("connected")
    
    socket.coords=[80+Math.floor(Math.random()*mapwidth)*160,80+Math.floor(Math.random()*mapheight)*160,0,0, Math.floor(Math.random()*8), 0] //x position, y position, turret rotation, chasis rotation
    socket.forward=false
    socket.backward=false
    socket.right=false
    socket.left=false
    socket.mouserot=0
	
	socket.effects={}
    socket.effects.dead=false
    socket.effects.lastshot=0
    
	
	
	
    socket.effects.shield=0
    socket.effects.laser=0
    socket.effects.shotgun=0
    socket.effects.reload=0
    socket.effects.speed=0
    socket.effects.invis=0
    socket.effects.chill=0
    socket.effects.revive=0
    socket.effects.reviving=0
    
    
    socket.emit("wallUpdate", walls)
    socket.on("pressedKey", (key)=>{
        switch (key){
            case "KeyW":
                socket.forward=true
            break
            case "KeyS":
                socket.backward=true
            break
            case "KeyA":
                socket.left=true
            break
            case "KeyD":
                socket.right=true
            break
        }
        
    })
    socket.on("releasedKey", (key)=>{
        
        switch (key){
            case "KeyW":
                socket.forward=false
            break
            case "KeyS":
                socket.backward=false
            break
            case "KeyA":
                socket.left=false
            break
            case "KeyD":
                socket.right=false
            break
        }
        
    })
    
    socket.on("pressedMouse", (msg)=>{
        time=new Date()
        if((socket.effects.lastshot)<time.getTime() && socket.effects.reviving==0){
            socket.effects.invis=0
            io.emit("playSound", "shoot")
            if(socket.effects.shotgun){
                socket.effects.shotgun=0
                for(let i=0; i<5; i++){
                    let diffangle=(Math.random()-0.5)/3+socket.coords[3]
                    if(diffangle>(2*Math.PI)){
                        diffangle-=(2*Math.PI)
                    }
                    if(diffangle<0){
                        diffangle+=(2*Math.PI)
                    }
                    let projec=[socket.coords[0]+turretlen*Math.cos(socket.coords[3]), socket.coords[1]-turretlen*Math.sin(socket.coords[3]), diffangle, 0]
                    projectiles.push([...projec])
                    
                }
            }else{
                projectiles.push([socket.coords[0]+turretlen*Math.cos(socket.coords[3]), socket.coords[1]-turretlen*Math.sin(socket.coords[3]), socket.coords[3], socket.effects.laser])
                socket.effects.laser=0
            }
            socket.effects.lastshot=time.getTime()+2000
            if(socket.effects.reload){
                socket.effects.lastshot-=1500
            }
        }
        
    })
    
    socket.on("movedMouse", (rot)=>{
        socket.mouserot=rot
    })
    players.push(socket)
    
    socket.on("disconnect", async ()=>{  //deleting all instances of the client existing on the server
        console.log(socket.coords)
        let disc=players.indexOf(socket)
        await players.splice(disc, 1)
		console.log("disconnected "+disc)
	})
})


http.listen(42069, ()=>{});
