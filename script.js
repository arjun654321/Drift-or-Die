window.addEventListener("DOMContentLoaded",app);

function app() {
	var header = document.querySelector("header"),
		difSelect = document.querySelector(".difficulty-select"),
		difButtons = difSelect.querySelectorAll("button"),
		tutorialBox = document.querySelector(".tutorial"),
		replayButton = document.querySelector(".replay"),

		scene,
		camera,
		renderer,
		hemiLight,
		pointLight,
		touch = {hold: false, x: 0},

		difSelectActive = false,
		scoreCounterActive = false,
		replayBtnActive = false,

		game = null,
		randomInt = (min,max) => Math.round(Math.random() * (max - min)) + min,
		skyColor = 0x69c6d0,
		pointLightZ = -60,
		cameraY = 45,
		cameraYMin = 7,
		renderDistance = 8,
		roadChunks = [];

	class Game {
		constructor(args) {
			
			let d = args.difficulty;
			this.difficulty = d >= 0 && d <= 3 ? d : 1;

			this.tutorial = args.tutorial === true;
			this.over = false;
			this.preparingNew = false;
			this.score = 0;
			this.noScoreXZone = 15;
			this.vehicles = [
				new Vehicle({
					color: 0xff1717,
					x: 0,
					z: 0,
					modelID: 0,
					speed: 1,
					acceleration: 0.001 * 2**d,
					name: "Vehicle 0"
				})
			];
			this.vehicleSpawns = this.vehicles.length;
			this.vehicleLimit = 9;
			this.vehicleIDCtrld = 0;
			this.spark = null;
		}
	}
	class RoadChunk {
		constructor(zSpaces) {
			let chunkSize = 40,
				lineWidth = 1,
				lineHeight = 4,
				dotLines = 3;

			this.chunkSize = chunkSize;
			
			this.surfaceGeo = new THREE.PlaneBufferGeometry(chunkSize,chunkSize);
			this.surfaceMat = new THREE.MeshLambertMaterial({
				color: 0x575757
			});
			this.surface = new THREE.Mesh(this.surfaceGeo,this.surfaceMat);
			this.surface.name = "Road Chunk";
			this.surface.rotation.x = -Math.PI/2;
			this.surface.position.set(0,0,zSpaces*chunkSize);
			this.surface.receiveShadow = true;
			scene.add(this.surface);

			
			let lineGeo = new THREE.PlaneBufferGeometry(lineWidth,chunkSize),
				lineMat = new THREE.MeshLambertMaterial({
					color: 0xffffff
				}),
				line = new THREE.Mesh(lineGeo,lineMat);
			line.receiveShadow = true;

			let leftShoulder = line.clone();
			leftShoulder.position.set(-chunkSize*0.375,0,0.01);
			this.surface.add(leftShoulder);

			let rightShoulder = line.clone();
			rightShoulder.position.set(chunkSize*0.375,0,0.01);
			this.surface.add(rightShoulder);

			
			let dotLineGeo = new THREE.PlaneBufferGeometry(lineWidth,lineHeight),
				dotLineMat = new THREE.MeshLambertMaterial({
					color: 0xffffff
				}),
				dotLine = new THREE.Mesh(dotLineGeo,dotLineMat);

			for (let l = 0; l < dotLines; ++l) {
				let y = chunkSize/2 - (chunkSize / dotLines) * l - lineHeight/2;

				let leftLine = dotLine.clone();
				leftLine.position.set(-chunkSize*0.125,y,0.01);
				this.surface.add(leftLine);

				let rightLine = dotLine.clone();
				rightLine.position.set(chunkSize*0.125,y,0.01);
				this.surface.add(rightLine);
			}
		}
	}
	class Vehicle {
		constructor(args) {
			this.color = args.color || randomInt(0x171717,0xcccccc);
			this.x = args.x || 0;
			this.z = args.z || 0;
			this.width = 1;
			this.height = 1;
			this.depth = 1;
			this.speed = args.speed || 1;
			this.acceleration = args.acceleration || 0;
			this.model = null;
			this.name = args.name || "";

			this.maxSpeed = 4;
			this.isSteering = false;
			this.steerAngle = 0;
			this.maxSteerAngle = 30;
			this.steerSpeed = 0.15;
			this.steerDir = "";
			this.xLimit = 20;
			this.crashed = false;
			this.deceleration = 0.01;

			
			let modelID = args.modelID;

			if (modelID === undefined)
				modelID = Math.round(Math.random() * 2)

			
			switch (modelID) {
				case 1:
					this.width = 5;
					this.height = 5;
					this.depth = 10;
					this.model = new Truck(this.color,this.x,this.z,this.name); 
					break;
				case 2:
					this.width = 5;
					this.height = 8;
					this.depth = 18;
					this.model = new TractorTrailer(this.color,this.x,this.z,this.name);
					break;
				default:
					this.width = 5;
					this.height = 4;
					this.depth = 10;
					this.model = new Car(this.color,this.x,this.z,this.name);
					break;
			}
		}
		accelerate() {
			if (this.speed < this.maxSpeed) {
				this.speed += this.acceleration;
				this.speed = +(this.speed).toFixed(3);
			}
		}
		decelerate() {
			if (this.speed > 0) {
				this.speed -= this.deceleration;
				this.speed = +(this.speed).toFixed(3);

				if (this.speed < 0)
					this.speed = 0;
			}
		}
		move() {
			let mesh = this.model.mesh;

			
			this.z -= this.speed;
			mesh.position.z = this.z;

			
			if (this.isSteering && !this.crashed) {
				if (this.steerDir == "left") {
					this.x -= this.steerSpeed;

					if (this.steerAngle < this.maxSteerAngle)
						++this.steerAngle;
				}
				else if (this.steerDir == "right") {
					this.x += this.steerSpeed;

					if (this.steerAngle > -this.maxSteerAngle)
						--this.steerAngle;
				}

			
			} else if (!this.crashed) {
				if (this.steerAngle > 0) {
					--this.steerAngle;
					this.x -= this.steerSpeed;

				} else if (this.steerAngle < 0) {
					++this.steerAngle;
					this.x += this.steerSpeed;
				}
			}

			
			if (this.x < -this.xLimit || this.x > this.xLimit) {
				this.crashed = true;
				game.over = true;
			}

			mesh.position.x = this.x;
			mesh.rotation.y = this.steerAngle * Math.PI/180;

			if (!this.crashed) {
				mesh.getObjectByName("FL").rotation.y = mesh.rotation.y;
				mesh.getObjectByName("FR").rotation.y = mesh.rotation.y;
			}
		}
		steer(dir) {
			this.isSteering = true;
			this.steerDir = dir;
		}
		straighten() {
			this.isSteering = false;
			this.steerDir = "";
		}
	}
	class Car {
		constructor(color,x,z,name) {
			
			this.mass = 3;
			this.mesh = new THREE.Object3D();
			this.mesh.name = name;
			this.mesh.position.set(x,2,z);
			scene.add(this.mesh);

			
			var carBodyBase = new THREE.Mesh(new THREE.BoxBufferGeometry(5,3,10)),
				cutFront = new THREE.Mesh(new THREE.BoxBufferGeometry(5,1,3)),
				cutBack = new THREE.Mesh(new THREE.BoxBufferGeometry(5,1,2)),
				frontTireHoles = new THREE.Mesh(new THREE.CylinderBufferGeometry(1.2,1.2,5,16,16,false)),
				backTireHoles = frontTireHoles.clone();

			cutFront.position.set(0,1,-3.5);
			cutBack.position.set(0,1,4);

			frontTireHoles.position.set(0,-1.5,-3);
			frontTireHoles.rotation.z = 90 * Math.PI/180;

			backTireHoles.position.set(0,-1.5,3);
			backTireHoles.rotation.z = frontTireHoles.rotation.z;

			carBodyBase.updateMatrix();
			cutFront.updateMatrix();
			cutBack.updateMatrix();
			frontTireHoles.updateMatrix();
			backTireHoles.updateMatrix();

			var carBodyBase_BSP = CSG.fromMesh(carBodyBase),
				cutFront_BSP = CSG.fromMesh(cutFront),
				cutBack_BSP = CSG.fromMesh(cutBack),
				frontTireHoles_BSP = CSG.fromMesh(frontTireHoles),
				backTireHoles_BSP = CSG.fromMesh(backTireHoles),
				carBody_BSP = carBodyBase_BSP
					.subtract(cutFront_BSP)
					.subtract(cutBack_BSP)
					.subtract(frontTireHoles_BSP)
					.subtract(backTireHoles_BSP),
				carBody = CSG.toMesh(carBody_BSP, carBodyBase.matrix);

			carBody.material = new THREE.MeshLambertMaterial({
				color: color
			});
			carBody.position.set(0,0.5,0);
			carBody.castShadow = true;
			this.mesh.add(carBody);

			
			var wheelGeo = new THREE.CylinderBufferGeometry(1,1,0.5,24,24,false),
				wheelMat = new THREE.MeshLambertMaterial({
					color: 0x171717
				}),
				wheel = new THREE.Mesh(wheelGeo,wheelMat);
			wheel.castShadow = true;
			wheel.rotation.z = -0.5 * Math.PI;

			var wheelPos = [
				{x: -2.25, y: -1, z: 3, name: "BL"},
				{x: 2.25, y: -1, z: 3, name: "BR"},
				{x: -2.25, y: -1, z: -3, name: "FL"},
				{x: 2.25, y: -1, z: -3, name: "FR"}
			];
			for (let p of wheelPos) {
				var w = wheel.clone();
				w.name = p.name;
				w.position.set(p.x,p.y,p.z);
				this.mesh.add(w);
			}

			
			var windowMat = new THREE.MeshLambertMaterial({
					color: 0x171717
				}),

				horzWindowGeo = new THREE.PlaneBufferGeometry(4.4,0.8),
				horzWindowMat = windowMat,
				horzWindow = new THREE.Mesh(horzWindowGeo,horzWindowMat),

				midFrontWindowGeo = new THREE.PlaneBufferGeometry(2.3,0.8),
				midFrontWindowMat = windowMat,
				midFrontWindow = new THREE.Mesh(midFrontWindowGeo,midFrontWindowMat),

				midBackWindowGeo = new THREE.PlaneBufferGeometry(1.5,0.8),
				midBackWindowMat = windowMat,
				midBackWindow = new THREE.Mesh(midBackWindowGeo,midBackWindowMat);

			horzWindow.receiveShadow = true;
			midFrontWindow.receiveShadow = true;
			midBackWindow.receiveShadow = true;

			var leftMFWindow = midFrontWindow.clone();
			leftMFWindow.position.set(-2.51,1.4,-0.4);
			leftMFWindow.rotation.y = -0.5 * Math.PI;
			this.mesh.add(leftMFWindow);

			var rightMFWindow = midFrontWindow.clone();
			rightMFWindow.position.set(2.51,1.4,-0.4);
			rightMFWindow.rotation.y = 0.5 * Math.PI;
			this.mesh.add(rightMFWindow);

			var leftMBWindow = midBackWindow.clone();
			leftMBWindow.position.set(-2.51,1.4,1.9);
			leftMBWindow.rotation.y = -0.5 * Math.PI;
			this.mesh.add(leftMBWindow);

			var rightMBWindow = midBackWindow.clone();
			rightMBWindow.position.set(2.51,1.4,1.9);
			rightMBWindow.rotation.y = 0.5 * Math.PI;
			this.mesh.add(rightMBWindow);

			var frontWindow = horzWindow.clone();
			frontWindow.position.set(0,1.4,-2.01);
			frontWindow.rotation.y = Math.PI;
			this.mesh.add(frontWindow);

			var backWindow = horzWindow.clone();
			backWindow.position.set(0,1.4,3.01);
			this.mesh.add(backWindow);

			
			var lightGeo = new THREE.PlaneBufferGeometry(1,0.5),
				frontLightMat = new THREE.MeshLambertMaterial({
					color: 0xf1f1f1
				}),
				frontLight = new THREE.Mesh(lightGeo,frontLightMat),
				backLightMat = new THREE.MeshLambertMaterial({
					color: 0xf65555
				}),
				backLight = new THREE.Mesh(lightGeo,backLightMat);

			frontLight.rotation.y = Math.PI;

			var frontLeftLight = frontLight.clone();
			frontLeftLight.position.set(-2,0.25,-5.01);
			this.mesh.add(frontLeftLight);

			var frontRightLight = frontLight.clone();
			frontRightLight.position.set(2,0.25,-5.01);
			this.mesh.add(frontRightLight);

			var backLeftLight = backLight.clone();
			backLeftLight.position.set(-2,0.25,5.01);
			this.mesh.add(backLeftLight);

			var backRightLight = backLight.clone();
			backRightLight.position.set(2,0.25,5.01);
			this.mesh.add(backRightLight);
		}
	}
	class Truck {
		constructor(color,x,z,name) {
			
			this.mass = 4;
			this.mesh = new THREE.Object3D();
			this.mesh.name = name;
			this.mesh.position.set(x,2.5,z);
			scene.add(this.mesh);

			
			var truckBodyBase = new THREE.Mesh(new THREE.BoxBufferGeometry(5,4,10)),
				cutFront = new THREE.Mesh(new THREE.BoxBufferGeometry(5,1.5,2.5)),
				cutBack = new THREE.Mesh(new THREE.BoxBufferGeometry(5,1.5,4.5)),
				frontTireHoles = new THREE.Mesh(new THREE.CylinderBufferGeometry(1.2,1.2,5,16,16,false)),
				backTireHoles = frontTireHoles.clone(),
				trunk = new THREE.Mesh(new THREE.BoxBufferGeometry(4.4,1.5,4));

			cutFront.position.set(0,1.25,-3.75);
			cutBack.position.set(0,1.25,3);

			frontTireHoles.position.set(0,-2,-3);
			frontTireHoles.rotation.z = 90 * Math.PI/180;

			backTireHoles.position.set(0,-2,3);
			backTireHoles.rotation.z = frontTireHoles.rotation.z;

			trunk.position.set(0,0.1,2.75);

			truckBodyBase.updateMatrix();
			cutFront.updateMatrix();
			cutBack.updateMatrix();
			frontTireHoles.updateMatrix();
			backTireHoles.updateMatrix();
			trunk.updateMatrix();

			var truckBodyBase_BSP = CSG.fromMesh(truckBodyBase),
				cutFront_BSP = CSG.fromMesh(cutFront),
				cutBack_BSP = CSG.fromMesh(cutBack),
				frontTireHoles_BSP = CSG.fromMesh(frontTireHoles),
				backTireHoles_BSP = CSG.fromMesh(backTireHoles),
				trunk_BSP = CSG.fromMesh(trunk),
				truckBody_BSP = truckBodyBase_BSP
					.subtract(cutFront_BSP)
					.subtract(cutBack_BSP)
					.subtract(frontTireHoles_BSP)
					.subtract(backTireHoles_BSP)
					.subtract(trunk_BSP),
				truckBody = CSG.toMesh(truckBody_BSP, truckBodyBase.matrix);

			truckBody.material = new THREE.MeshLambertMaterial({
				color: color
			});
			truckBody.position.set(0,0.5,0);
			truckBody.castShadow = true;
			this.mesh.add(truckBody);

			
			var wheelGeo = new THREE.CylinderBufferGeometry(1,1,0.5,24,24,false),
				wheelMat = new THREE.MeshLambertMaterial({
					color: 0x171717
				}),
				wheel = new THREE.Mesh(wheelGeo,wheelMat);
			wheel.castShadow = true;
			wheel.rotation.z = -0.5 * Math.PI;

			var wheelPos = [
				{x: -2.25, y: -1.5, z: 3, name: "BL"},
				{x: 2.25, y: -1.5, z: 3, name: "BR"},
				{x: -2.25, y: -1.5, z: -3, name: "FL"},
				{x: 2.25, y: -1.5, z: -3, name: "FR"}
			];
			for (let p of wheelPos) {
				var w = wheel.clone();
				w.name = p.name;
				w.position.set(p.x,p.y,p.z);
				this.mesh.add(w);
			}

			
			var windowMat = new THREE.MeshLambertMaterial({
					color: 0x171717
				}),

				horzWindowGeo = new THREE.PlaneBufferGeometry(4.4,1.2),
				horzWindowMat = windowMat,
				horzWindow = new THREE.Mesh(horzWindowGeo,horzWindowMat),

				midFrontWindowGeo = new THREE.PlaneBufferGeometry(1.4,1.2),
				midFrontWindowMat = windowMat,
				midFrontWindow = new THREE.Mesh(midFrontWindowGeo,midFrontWindowMat),

				midBackWindowGeo = new THREE.PlaneBufferGeometry(1,1.2),
				midBackWindowMat = windowMat,
				midBackWindow = new THREE.Mesh(midBackWindowGeo,midBackWindowMat);

			horzWindow.receiveShadow = true;
			midFrontWindow.receiveShadow = true;
			midBackWindow.receiveShadow = true;

			var leftMFWindow = midFrontWindow.clone();
			leftMFWindow.position.set(-2.51,1.55,-1.55);
			leftMFWindow.rotation.y = -0.5 * Math.PI;
			this.mesh.add(leftMFWindow);

			var rightMFWindow = midFrontWindow.clone();
			rightMFWindow.position.set(2.51,1.55,-1.55);
			rightMFWindow.rotation.y = 0.5 * Math.PI;
			this.mesh.add(rightMFWindow);

			var leftMBWindow = midBackWindow.clone();
			leftMBWindow.position.set(-2.51,1.55,-0.05);
			leftMBWindow.rotation.y = -0.5 * Math.PI;
			this.mesh.add(leftMBWindow);

			var rightMBWindow = midBackWindow.clone();
			rightMBWindow.position.set(2.51,1.55,-0.05);
			rightMBWindow.rotation.y = 0.5 * Math.PI;
			this.mesh.add(rightMBWindow);

			var frontWindow = horzWindow.clone();
			frontWindow.position.set(0,1.55,-2.51);
			frontWindow.rotation.y = Math.PI;
			this.mesh.add(frontWindow);

			var backWindow = horzWindow.clone();
			backWindow.position.set(0,1.55,0.76);
			this.mesh.add(backWindow);

			
			var lightGeo = new THREE.PlaneBufferGeometry(0.75,1),
				frontLightMat = new THREE.MeshLambertMaterial({
					color: 0xf1f1f1
				}),
				frontLight = new THREE.Mesh(lightGeo,frontLightMat),
				backLightMat = new THREE.MeshLambertMaterial({
					color: 0xf65555
				}),
				backLight = new THREE.Mesh(lightGeo,backLightMat);

			frontLight.rotation.y = Math.PI;

			var frontLeftLight = frontLight.clone();
			frontLeftLight.position.set(-2.125,0.25,-5.01);
			this.mesh.add(frontLeftLight);

			var frontRightLight = frontLight.clone();
			frontRightLight.position.set(2.125,0.25,-5.01);
			this.mesh.add(frontRightLight);

			var backLeftLight = backLight.clone();
			backLeftLight.position.set(-2.125,0.25,5.01);
			this.mesh.add(backLeftLight);

			var backRightLight = backLight.clone();
			backRightLight.position.set(2.125,0.25,5.01);
			this.mesh.add(backRightLight);
		}
	}
	class TractorTrailer {
		constructor(color,x,z,name) {
			
			this.mass = 12;
			this.mesh = new THREE.Object3D();
			this.mesh.name = name;
			this.mesh.position.set(x,4,z);
			scene.add(this.mesh);

			
			var cabPt1Geo = new THREE.BoxBufferGeometry(5,4,5),
				cabPt1Mat = new THREE.MeshLambertMaterial({
					color: color
				}),
				cabPt1 = new THREE.Mesh(cabPt1Geo,cabPt1Mat);
			cabPt1.position.set(0,1,-6.5);
			cabPt1.castShadow = true;
			this.mesh.add(cabPt1);

			var cabPt2Geo = new THREE.BoxBufferGeometry(5,2,0.5),
				cabPt2Mat = cabPt1Mat,
				cabPt2 = new THREE.Mesh(cabPt2Geo,cabPt2Mat);
			cabPt2.position.set(0,-2,-8.75);
			cabPt2.castShadow = true;
			this.mesh.add(cabPt2);

			var cabPt3Geo = new THREE.BoxBufferGeometry(3,2,8.25),
				cabPt3Mat = new THREE.MeshLambertMaterial({
					color: 0x3f3f3f
				}),
				cabPt3 = new THREE.Mesh(cabPt3Geo,cabPt3Mat);
			cabPt3.position.set(0,-2,-4.375);
			cabPt3.castShadow = true;
			this.mesh.add(cabPt3);

			var cabLeftWindowGeo = new THREE.PlaneBufferGeometry(2.5,2),
				cabLeftWindowMat = new THREE.MeshLambertMaterial({
					color: 0x171717
				}),
	        	cabLeftWindow = new THREE.Mesh(cabLeftWindowGeo,cabLeftWindowMat);
			cabLeftWindow.position.set(-2.51,1,-7.75);
			cabLeftWindow.rotation.y = -0.5 * Math.PI;
			cabLeftWindow.receiveShadow = true;
			this.mesh.add(cabLeftWindow);

			var cabRightWindow = cabLeftWindow.clone();
			cabRightWindow.position.x = -cabLeftWindow.position.x;
			cabRightWindow.rotation.y = -cabLeftWindow.rotation.y;
			this.mesh.add(cabRightWindow);

			var cabFrontWindowGeo = new THREE.PlaneBufferGeometry(5,2),
				cabFrontWindowMat = cabLeftWindowMat,
	        	cabFrontWindow = new THREE.Mesh(cabFrontWindowGeo,cabFrontWindowMat);
			cabFrontWindow.position.set(0,1,-9.01);
			cabFrontWindow.rotation.y = Math.PI;
			cabFrontWindow.receiveShadow = true;
			this.mesh.add(cabFrontWindow);

			var lightGeo = new THREE.PlaneBufferGeometry(1,1),
				lightMat = new THREE.MeshLambertMaterial({
					color: 0xf1f1f1
				}),
				light = new THREE.Mesh(lightGeo,lightMat);

			light.rotation.y = Math.PI;

			var leftLight = light.clone();
			leftLight.position.set(-1.5,-1.5,-9.01);
			this.mesh.add(leftLight);

			var rightLight = light.clone();
			rightLight.position.set(1.5,-1.5,-9.01);
			this.mesh.add(rightLight);

			
			var cabLeftCylinderGeo = new THREE.CylinderBufferGeometry(0.75,0.75,2.25,16,16,false),
				cabLeftCylinderMat = new THREE.MeshLambertMaterial({
					color: 0x7f7f7f
				}),
				cabLeftCylinder = new THREE.Mesh(cabLeftCylinderGeo,cabLeftCylinderMat);
			cabLeftCylinder.position.set(-2.25,-1.875,-3.875);
			cabLeftCylinder.rotation.x = -0.5 * Math.PI;
			cabLeftCylinder.castShadow = true;
			this.mesh.add(cabLeftCylinder);

			var cabRightCylinder = cabLeftCylinder.clone();
			cabRightCylinder.position.x = -cabLeftCylinder.position.x;
			this.mesh.add(cabRightCylinder);

			
			var trailerGeo = new THREE.BoxBufferGeometry(5,5,12),
				trailerMat = new THREE.MeshLambertMaterial({
					color: 0xffffff
				}),
				trailer = new THREE.Mesh(trailerGeo,trailerMat);
			trailer.position.set(0,1.5,3);
			trailer.castShadow = true;
			this.mesh.add(trailer);

			var trailerBottomGeo = new THREE.BoxBufferGeometry(3,2,2),
				trailerBottomMat = cabPt3Mat,
				trailerBottom = new THREE.Mesh(trailerBottomGeo,trailerBottomMat);
			trailerBottom.position.set(0,-2,7);
			trailerBottom.castShadow = true;
			this.mesh.add(trailerBottom);

			
			var wheelGeo = new THREE.CylinderBufferGeometry(1.5,1.5,1,24,24,false),
				wheelMat = new THREE.MeshLambertMaterial({
					color: 0x242424
				}),
				wheel = new THREE.Mesh(wheelGeo,wheelMat);
			wheel.castShadow = true;
			wheel.rotation.z = -0.5 * Math.PI;

			var wheelPos = [
				{x: -2, y: -2.5, z: 7, name: "BL"},
				{x: 2, y: -2.5, z: 7, name: "BR"},
				{x: -2, y: -2.5, z: -1, name: "ML"},
				{x: 2, y: -2.5, z: -1, name: "MR"},
				{x: -2, y: -2.5, z: -6.75, name: "FL"},
				{x: 2, y: -2.5, z: -6.75, name: "FR"}
			];
			for (let p of wheelPos) {
				var w = wheel.clone();
				w.name = p.name;
				w.position.set(p.x,p.y,p.z);
				this.mesh.add(w);
			}
		}
	}
	class Spark {
		constructor(x,y,z,isHorz = false) {
			this.center = new THREE.Object3D();
			this.center.name = "Spark";
			this.center.position.set(x,y,z);
			scene.add(this.center);

			this.isHorz = isHorz;
			this.particles = [];

			
			let particleGeo = new THREE.SphereBufferGeometry(1,16,16),
				particleMat = new THREE.MeshBasicMaterial({
					color: 0xffff00
				}),
				particleMesh = new THREE.Mesh(particleGeo,particleMat);

			for (var m = 0; m < randomInt(6,8); ++m) {
				this.particles.push({
					x: 0,
					y: 0,
					z: 0,
					size: 1,
					speed: 0.2,
					decay: 0.04,
					angle: randomInt(0,359),
					mesh: particleMesh.clone()
				});
				this.center.add(this.particles[m].mesh);
			}
		}
		moveParticles() {
			
			for (let p of this.particles) {
				if (p.size > 0) {
					p.size -= p.decay;

					if (this.isHorz === true) {
						p.x += p.speed * Math.sin(p.angle * Math.PI/180);
						p.mesh.position.x = p.x;
					}
					else {
						p.z += p.speed * Math.sin(p.angle * Math.PI/180);
						p.mesh.position.z = p.z;
					}

					p.y += p.speed * Math.cos(p.angle * Math.PI/180);
					p.mesh.position.y = p.y;

					p.mesh.scale.x = p.size;
					p.mesh.scale.y = p.size;
					p.mesh.scale.z = p.size;
				}
			}
		}
	}

	var init = () => {
			
			scene = new THREE.Scene();
			camera = new THREE.PerspectiveCamera(45,window.innerWidth / window.innerHeight,0.1,2000);
			renderer = new THREE.WebGLRenderer({
				logarithmicDepthBuffer: true
			});
			renderer.setClearColor(new THREE.Color(skyColor));
			renderer.setSize(window.innerWidth, window.innerHeight);
			renderer.shadowMap.enabled = true;

			
			
			var ambientLight = new THREE.AmbientLight(0xffffff);
			ambientLight.name = "Ambient Light";
			scene.add(ambientLight);

			
			hemiLight = new THREE.HemisphereLight(0x0044ff, 0xffffff, 0.5);
			hemiLight.name = "Hemisphere Light";
			hemiLight.position.set(0,5,0);
			scene.add(hemiLight);
			
			
			pointLight = new THREE.PointLight(0xffffff,0.5);
			pointLight.name = "Point Light";
			pointLight.position.set(0,60,pointLightZ);
			pointLight.castShadow = true;
			pointLight.shadow.mapSize = new THREE.Vector2(1024,1024);
			scene.add(pointLight);

			
			
			for (let r = 1; r > -renderDistance; --r)
				roadChunks.push(new RoadChunk(r));

			
			var firstChunkSize = roadChunks[0].chunkSize,
				grassDepth = firstChunkSize * (renderDistance + 1),
				grassGeo = new THREE.PlaneBufferGeometry(400,grassDepth),
				grassMat = new THREE.MeshLambertMaterial({
					color: 0xbbe868
				}),
				grass = new THREE.Mesh(grassGeo,grassMat);

			grass.name = "Grass";
			grass.rotation.x = -Math.PI/2;
			grass.position.set(0,-0.05,-grassDepth/2 + firstChunkSize*1.5);
			grass.receiveShadow = true;
			scene.add(grass);

			
			scene.fog = new THREE.Fog(skyColor, 0.01, grassDepth - firstChunkSize*2);

			
			camera.position.set(0,cameraYMin,30);
			camera.lookAt(scene.position);
			
			
			document.body.appendChild(renderer.domElement);
		},
		checkCollision = (a,b) => {
			if (!a.crashed && !b.crashed && (a.name != b.name)) {
				let A_left = a.x - a.width/2,
					A_right = a.x + a.width/2,
					A_front = a.z - a.depth/2,
					A_back = a.z + a.depth/2,
					B_left = b.x - b.width/2,
					B_right = b.x + b.width/2,
					B_front = b.z - b.depth/2,
					B_back = b.z + b.depth/2;

				
				let touchedX_RL = (A_left <= B_right && A_left >= B_left),
					touchedX_LR = (A_right >= B_left && A_right <= B_right),
				
					touchedZ_FB = (A_front <= B_back && A_front >= B_front),
					touchedZ_BF = (A_back >= B_front && A_back <= B_back);
				
				if ((touchedX_RL || touchedX_LR) && (touchedZ_FB || touchedZ_BF)) {
					var newMomentum = (a.model.mass * a.speed + b.model.mass * b.speed)/(a.model.mass + b.model.mass);

					a.speed = newMomentum;
					b.speed = newMomentum;
					
					let sx = 0,
						sz = 0;

					
					if (A_left <= B_right)
						sx = (A_left + B_right)/2;
					else if (A_right >= B_left)
						sx = (A_right + B_left)/2;

					
					if (A_front <= B_back)
						sz = (A_front + B_back)/2;
					else if (A_back >= B_front)
						sz = (A_back + B_front)/2;

					
					if (a.name == "Vehicle 0") {
						a.crashed = true;
						game.over = true;
						game.spark = new Spark(sx,a.height/2,sz,A_front - B_back < 1);
					}
				}
			}
		},
		toggleDifBtnStates = () => {
			for (let b of difButtons)
				b.disabled = !b.disabled;
		},
		toggleDifMenu = () => {
			difSelectActive = !difSelectActive;

			let activeClass = "menu-active",
				inactiveClass = "menu-inactive";

			if (difSelectActive) {
				difSelect.classList.remove(inactiveClass);
				void difSelect.offsetWidth;
				difSelect.classList.add(activeClass);
				setTimeout(toggleDifBtnStates,1500);

			} else {
				difSelect.classList.remove(activeClass);
				void difSelect.offsetWidth;
				difSelect.classList.add(inactiveClass);
				toggleDifBtnStates();
			}
		},
		toggleScoreCounter = () => {
			scoreCounterActive = !scoreCounterActive;

			let activeClass = "score-active";

			if (scoreCounterActive)
				header.classList.add(activeClass);
			else
				header.classList.remove(activeClass);
		},
		toggleReplayBtn = () => {
			replayBtnActive = !replayBtnActive;
			replayButton.disabled = !replayBtnActive;

			let activeClass = "replay-active";

			if (replayBtnActive)
				replayButton.classList.add(activeClass);
			else
				replayButton.classList.remove(activeClass);
		},
		showTutorial = () => {
			if (game.tutorial)
				tutorialBox.classList.add("tutorial-active");
		},
		hideTutorial = () => {
			if (game.tutorial) {
				game.tutorial = false;
				tutorialBox.classList.remove("tutorial-active");
			}
		},
		startGame = difficulty => {
			if (game != null && game.over) {
				
				if (game.spark != null) {
					let sparkName = scene.getObjectByName(game.spark.name);
					scene.remove(sparkName);
				}
				
				for (let v of game.vehicles) {
					let vehicleName = scene.getObjectByName(v.name);
					scene.remove(vehicleName);
				}
			}

			
			if (game == null || game.over) {
				game = new Game({
					difficulty: difficulty,
					tutorial: game == null
				});
				header.innerHTML = game.score;
				toggleScoreCounter();
				showTutorial();
			}
		},
		update = () => {
			
			if (cameraY > cameraYMin) {
				cameraY -= 0.5;
				if (cameraY == cameraYMin)
					toggleDifMenu();
			}

			
			if (game != null && cameraY == cameraYMin) {
				let firstChunkSize = roadChunks[0].chunkSize,
					vehicleCtrld = game.vehicles[game.vehicleIDCtrld];

				
				if (vehicleCtrld.z <= -firstChunkSize) {
					let vehiclesBehind = [];
					game.vehicles.forEach((e,i) => {
						e.z += firstChunkSize;

						
						if (e.z - e.depth/2 > vehicleCtrld.z + firstChunkSize/2) {
							vehiclesBehind.push({
								index: i,
								name: e.name
							});
						}
					});
					
					vehiclesBehind.sort((a,b) => b.index - a.index);
					for (let v of vehiclesBehind) {
						let objectName = scene.getObjectByName(v.name);
						scene.remove(objectName);
						game.vehicles.splice(v.index,1);

						
						if (Math.abs(vehicleCtrld.x) < game.noScoreXZone) {
							++game.score;
							header.innerHTML = game.score;
						}
					}

					
					if (game.vehicles.length < game.vehicleLimit && !game.tutorial) {
						let spawnTries = 3;
						while (spawnTries--) {
							if (Math.random() < 0.05 + game.difficulty * 0.025) {
								game.vehicles.push(new Vehicle({
									x: (-1 + spawnTries) * 10,
									z: -renderDistance * firstChunkSize - spawnTries * 15,
									name: "Vehicle " + game.vehicleSpawns
								}));
								++game.vehicleSpawns;
							}
						}
					}
				}

				
				let vehiclesAhead = [];
				game.vehicles.forEach((e,i) => {
					e.move();

					for (let v of game.vehicles)
						checkCollision(e,v);

					if (!game.tutorial) {
						if (!e.crashed)
							e.accelerate();
						else {
							e.decelerate();

							
							if (e.steerAngle > 0)
								e.steerAngle += e.speed * e.steerSpeed;
							else if (e.steerAngle < 0)
								e.steerAngle -= e.speed * e.steerSpeed;
						}
					}
					
					
					if (e.z < (-renderDistance - 1.5) * firstChunkSize) {
						vehiclesAhead.push({
							index: i,
							name: e.name
						});
					}
				});
				
				vehiclesAhead.sort((a,b) => b.index - a.index);
				for (let v of vehiclesAhead) {
					let objectName = scene.getObjectByName(v.name);
					scene.remove(objectName);
					game.vehicles.splice(v.index,1);
				}

				
				if (game.spark != null) {
					game.spark.moveParticles();
					game.spark.center.position.z = vehicleCtrld.z - (game.spark.isHorz ? vehicleCtrld.depth/2 : 0);
				}

				
				if (vehicleCtrld.speed <= 0 && game.over && !game.preparingNew && !replayBtnActive)
					toggleReplayBtn();

				
				pointLight.position.z = vehicleCtrld.z + pointLightZ;
				camera.position.set(0,cameraY,vehicleCtrld.z + 30);

			} else {
				pointLight.position.z = pointLightZ;
				camera.position.set(0,cameraY,30);
			}

			renderer.render(scene,camera);
			requestAnimationFrame(update);
		},
		adjustWindow = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth,window.innerHeight)
		},
		steerVehicle = e => {
			if (game != null && !game.over && game.vehicles.length) {
				let playerVehicle = game.vehicles[game.vehicleIDCtrld];

				
				if ((e.keyCode && (e.keyCode == 37 || e.keyCode == 65)) || 
					(touch.hold && e.pageX < touch.x)) {
					playerVehicle.steer("left");
					hideTutorial();

				
				} else if ((e.keyCode && (e.keyCode == 39 || e.keyCode == 68)) || 
					(touch.hold && e.pageX > touch.x)) {
					playerVehicle.steer("right");
					hideTutorial();
				}
			}
		},
		straightenVehicle = () => {
			if (game != null && !game.over && game.vehicles.length) {
				game.vehicles[game.vehicleIDCtrld].straighten();
			}
			touch.hold = false;
		},
		getTouchHold = e => {
			touch.hold = true;
			touch.x = e.pageX;
		};

	init();
	update();
	
	window.addEventListener("resize",adjustWindow);

	
	var downEvent = "ontouchstart" in document.documentElement ? "touchstart" : "mousedown",
		moveEvent = "ontouchmove" in document.documentElement ? "touchmove" : "mousemove",
		upEvent = "ontouchend" in document.documentElement ? "touchend" : "mouseup";

	document.addEventListener("keydown",steerVehicle);
	document.addEventListener("keyup",straightenVehicle);
	document.addEventListener(downEvent,getTouchHold);
	document.addEventListener(moveEvent,steerVehicle);
	document.addEventListener(upEvent,straightenVehicle);

	
	for (let b of difButtons) {
		b.addEventListener("click",function(){
			toggleDifMenu();

			let t = this;
			setTimeout(() => {
				startGame(t.getAttribute("data-difficulty"));
			},1600);
		});
	}

	
	replayButton.addEventListener("click",function(){
		game.preparingNew = true;
		toggleScoreCounter();
		toggleReplayBtn();
		setTimeout(toggleDifMenu,250);
	});
}








"use strict"

class CSG {
    constructor() {
        this.polygons = [];
    }
    clone() {
        var csg = new CSG();
        csg.polygons = this.polygons.map(function(p) {
            return p.clone();
        });
        return csg;
    }

    toPolygons() {
        return this.polygons;
    }

    union(csg) {
        var a = new Node(this.clone().polygons);
        var b = new Node(csg.clone().polygons);
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        return CSG.fromPolygons(a.allPolygons());
    }

    subtract(csg) {
        var a = new Node(this.clone().polygons);
        var b = new Node(csg.clone().polygons);
        a.invert();
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        a.invert();
        return CSG.fromPolygons(a.allPolygons());
    }

    intersect(csg) {
        var a = new Node(this.clone().polygons);
        var b = new Node(csg.clone().polygons);
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.build(b.allPolygons());
        a.invert();
        return CSG.fromPolygons(a.allPolygons());
    }

   
    inverse() {
        var csg = this.clone();
        csg.polygons.map(function(p) {
            p.flip();
        });
        return csg;
    }
}

CSG.fromPolygons=function(polygons) {
    var csg = new CSG();
    csg.polygons = polygons;
    return csg;
}



class Vector extends THREE.Vector3 {
    constructor(x, y, z) {
        if (arguments.length == 3)
            super(x, y, z)
        else if (Array.isArray(x))
            super(x[0], x[1], x[2])
        else if (typeof x == 'object')
            super().copy(x)
        else
            throw "Invalid constructor to vector"
    }

    clone() {
        return new Vector(this)
    }
    negated() {
        return this.clone().multiplyScalar(-1)
    }
    plus(a) {
        return this.clone().add(a);
    }
    minus(a) {
        return this.clone().sub(a)
    }
    times(a) {
        return this.clone().multiplyScalar(a)
    }
    dividedBy(a) {
        return this.clone().divideScalar(a)
    }
    lerp(a, t) {
        return this.plus(a.minus(this).times(t))
    }
    unit() {
        return this.dividedBy(this.length())
    }
    cross(a) {
        return THREE.Vector3.prototype.cross.call(this.clone(), a)
    }
}


class Vertex {

    constructor(pos, normal, uv) {
        this.pos = new Vector(pos);
        this.normal = new Vector(normal);
        this.uv = new Vector(uv);
    }

    clone() {
        return new Vertex(this.pos.clone(),this.normal.clone(),this.uv.clone());
    }


    flip() {
        this.normal = this.normal.negated();
    }


    interpolate(other, t) {
        return new Vertex(this.pos.lerp(other.pos, t),this.normal.lerp(other.normal, t),this.uv.lerp(other.uv, t))
    }
}
;

class Plane {
    constructor(normal, w) {
        this.normal = normal;
        this.w = w;
    }

    clone() {
        return new Plane(this.normal.clone(),this.w);
    }

    flip() {
        this.normal = this.normal.negated();
        this.w = -this.w;
    }

    
    splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
        var COPLANAR = 0;
        var FRONT = 1;
        var BACK = 2;
        var SPANNING = 3;

        var polygonType = 0;
        var types = [];
        for (var i = 0; i < polygon.vertices.length; i++) {
            var t = this.normal.dot(polygon.vertices[i].pos) - this.w;
            var type = (t < -Plane.EPSILON) ? BACK : (t > Plane.EPSILON) ? FRONT : COPLANAR;
            polygonType |= type;
            types.push(type);
        }

        switch (polygonType) {
        case COPLANAR:
            (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
            break;
        case FRONT:
            front.push(polygon);
            break;
        case BACK:
            back.push(polygon);
            break;
        case SPANNING:
            var f = []
              , b = [];
            for (var i = 0; i < polygon.vertices.length; i++) {
                var j = (i + 1) % polygon.vertices.length;
                var ti = types[i]
                  , tj = types[j];
                var vi = polygon.vertices[i]
                  , vj = polygon.vertices[j];
                if (ti != BACK)
                    f.push(vi);
                if (ti != FRONT)
                    b.push(ti != BACK ? vi.clone() : vi);
                if ((ti | tj) == SPANNING) {
                    var t = (this.w - this.normal.dot(vi.pos)) / this.normal.dot(vj.pos.minus(vi.pos));
                    var v = vi.interpolate(vj, t);
                    f.push(v);
                    b.push(v.clone());
                }
            }
            if (f.length >= 3)
                front.push(new Polygon(f,polygon.shared));
            if (b.length >= 3)
                back.push(new Polygon(b,polygon.shared));
            break;
        }
    }

}

Plane.EPSILON = 1e-5;

Plane.fromPoints = function(a, b, c) {
    var n = b.minus(a).cross(c.minus(a)).unit();
    return new Plane(n,n.dot(a));
}



class Polygon {

    constructor(vertices, shared) {
        this.vertices = vertices;
        this.shared = shared;
        this.plane = Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
    }

    clone() {
        var vertices = this.vertices.map(function(v) {
            return v.clone();
        });
        return new Polygon(vertices,this.shared);
    }
    flip() {
        this.vertices.reverse().map(function(v) {
            v.flip();
        });
        this.plane.flip();
    }
}



class Node {
    constructor(polygons) {
        this.plane = null;
        this.front = null;
        this.back = null;
        this.polygons = [];
        if (polygons)
            this.build(polygons);
    }
    clone() {
        var node = new Node();
        node.plane = this.plane && this.plane.clone();
        node.front = this.front && this.front.clone();
        node.back = this.back && this.back.clone();
        node.polygons = this.polygons.map(function(p) {
            return p.clone();
        });
        return node;
    }

    invert() {
        for (var i = 0; i < this.polygons.length; i++)
            this.polygons[i].flip();
        
        this.plane.flip();
        if (this.front)
            this.front.invert();
        if (this.back)
            this.back.invert();
        var temp = this.front;
        this.front = this.back;
        this.back = temp;
    }

    clipPolygons(polygons) {
        if (!this.plane)
            return polygons.slice();
        var front = []
          , back = [];
        for (var i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], front, back, front, back);
        }
        if (this.front)
            front = this.front.clipPolygons(front);
        if (this.back)
            back = this.back.clipPolygons(back);
        else
            back = [];
        return front.concat(back);
    }

    clipTo(bsp) {
        this.polygons = bsp.clipPolygons(this.polygons);
        if (this.front)
            this.front.clipTo(bsp);
        if (this.back)
            this.back.clipTo(bsp);
    }

   
    allPolygons() {
        var polygons = this.polygons.slice();
        if (this.front)
            polygons = polygons.concat(this.front.allPolygons());
        if (this.back)
            polygons = polygons.concat(this.back.allPolygons());
        return polygons;
    }

  
    build(polygons) {
        if (!polygons.length)
            return;
        if (!this.plane)
            this.plane = polygons[0].plane.clone();
        var front = []
          , back = [];
        for (var i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
        }
        if (front.length) {
            if (!this.front)
                this.front = new Node();
            this.front.build(front);
        }
        if (back.length) {
            if (!this.back)
                this.back = new Node();
            this.back.build(back);
        }
    }
}

CSG.fromGeometry=function(geom){
    if(geom.isBufferGeometry)
        geom = new THREE.Geometry().fromBufferGeometry(geom)
    var fs = geom.faces;
    var vs = geom.vertices;
    var polys=[]
    var fm=['a','b','c']
    for(var i=0;i<fs.length;i++){
        var f = fs[i];
        var vertices=[]
        for(var j=0;j<3;j++) vertices.push(new Vertex(vs[f[fm[j]]],f.vertexNormals[j],geom.faceVertexUvs[0][i][j]))
        polys.push(new Polygon(vertices))
    }
    return CSG.fromPolygons(polys)
}
CSG._tmpm3 = new THREE.Matrix3();
CSG.fromMesh=function(mesh){

    var csg = CSG.fromGeometry(mesh.geometry)
    CSG._tmpm3.getNormalMatrix(mesh.matrix);
    for(var i=0;i<csg.polygons.length;i++){
        var p = csg.polygons[i]
        for(var j=0;j<p.vertices.length;j++){
            var v=p.vertices[j]
            v.pos.applyMatrix4(mesh.matrix);
            v.normal.applyMatrix3(CSG._tmpm3);
        }
    }
    return csg;
}

CSG.toMesh=function(csg,toMatrix){
    var geom = new THREE.Geometry();
    var ps = csg.polygons;
    var vs = geom.vertices;
    var fvuv = geom.faceVertexUvs[0]
    for(var i=0;i<ps.length;i++){
        var p = ps[i]
        var pvs=p.vertices;
        var v0=vs.length;
        var pvlen=pvs.length
        
        for(var j=0;j<pvlen;j++)
            vs.push(new THREE.Vector3().copy(pvs[j].pos))


        for(var j=3;j<=pvlen;j++){
            var fc = new THREE.Face3();
            var fuv = []
            fvuv.push(fuv)
            var fnml = fc.vertexNormals;
            fc.a=v0;
            fc.b=v0+j-2;
            fc.c=v0+j-1;

            fnml.push(new THREE.Vector3().copy(pvs[0].normal))
            fnml.push(new THREE.Vector3().copy(pvs[j-2].normal))
            fnml.push(new THREE.Vector3().copy(pvs[j-1].normal))
            fuv.push(new THREE.Vector3().copy(pvs[0].uv))
            fuv.push(new THREE.Vector3().copy(pvs[j-2].uv))
            fuv.push(new THREE.Vector3().copy(pvs[j-1].uv))

            fc.normal = new THREE.Vector3().copy(p.plane.normal)
            geom.faces.push(fc)
        }
    }
    var inv = new THREE.Matrix4().getInverse(toMatrix);
    geom.applyMatrix(inv);
    geom.verticesNeedUpdate = geom.elementsNeedUpdate = geom.normalsNeedUpdate = true;
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    var m = new THREE.Mesh(geom);
    m.matrix.copy(toMatrix);
    m.matrix.decompose(m.position,m.rotation,m.scale)
    m.updateMatrixWorld();
    return m
}


CSG.ieval=function(tokens,index=0){
    if(typeof tokens === 'string')
        CSG.currentOp=tokens;
    else if(tokens instanceof Array){
        for(let i=0;i<tokens.length;i++)CSG.ieval(tokens[i],0);
    }else if(typeof tokens==='object'){
        var op=CSG.currentOp;
        tokens.updateMatrix();
        tokens.updateMatrixWorld();
        if(!CSG.sourceMesh)
            CSG.currentPrim =  CSG.fromMesh(CSG.sourceMesh = tokens);
        else{
            CSG.nextPrim = CSG.fromMesh(tokens);
            CSG.currentPrim = CSG.currentPrim[op](CSG.nextPrim);
        }
        if(CSG.doRemove)tokens.parent.remove(tokens);
    }
}

CSG.eval=function(tokens,doRemove){
    CSG.currentOp=null;
    CSG.sourceMesh=null;
    CSG.doRemove=doRemove;
    CSG.ieval(tokens)
    var result = CSG.toMesh( CSG.currentPrim, CSG.sourceMesh.matrix );
    result.material = CSG.sourceMesh.material;
    result.castShadow  = result.receiveShadow = true;
    return result;
}
