import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as ATARIA from "ataria";


class SceneManager
{
    MODEL_TYPE_READY_PLAYER_ME = "readyPlayerMe";
    MODEL_TYPE_AVATURN = "avaturn";

    scene = null;
    camera = null;
    options = null;
    supportedModelTypes = null;
    animationClips = {}
    characters = [];


    constructor(scene, camera, options)
    {
        this.scene = scene;
        this.camera = camera;
        this.options = options ? options : {};

        this.supportedModelTypes = this.options.supportedModelTypes ? this.options.supportedModelTypes : ["readyPlayerMe", "avaturn"];

        if(options?.debug)
        {   
            scene.add(new THREE.CameraHelper(camera));
            scene.add( new THREE.AxesHelper(5));

        }

    }


    debug(message)
    {
        if(this.options.debug)
        {   
            console.info(message);

        }

    }


    async init()
    {
        for(let modelType of this.supportedModelTypes)
        {
            for(let [actionName, meta] of Object.entries(ATARIA.ACTION_MAP[modelType].female))
            {
                await this.loadAnimation(actionName, "female", meta.url, modelType, {source: meta.source, isDefault: meta.isDefault, removeNeckTracks: true})

            }

        }

    }


    async loadAnimation(actionName, gender, animationUrl, modelType, options)
    {
        try
        {
            this.debug(`Loading animation "${animationUrl.substring(animationUrl.lastIndexOf("/") + 1)}" for action "${actionName}"`);
            
            let loader = new GLTFLoader();
            let animation = await loader.loadAsync(animationUrl);
            
            this.debug("Loaded animation: ", animation);


            for (let clip of animation.animations)
            {   
                if(options.source == "mixamo")
                {   
                    clip.name = animationUrl.substring(animationUrl.lastIndexOf("/") + 1, animationUrl.indexOf(".glb"));

                    for(let track of clip.tracks)
                    {   
                        track.name = track.name.replace(/mixamorig/g, "");

                    }

                }


                if(options.removeNeckTracks)
                {
                    clip.tracks = clip.tracks.filter(track => !track.name.startsWith("Neck."));

                }

                if(options.removeSpineTracks)
                {
                    clip.tracks = clip.tracks.filter(track => !track.name.startsWith("Spine."));

                }

                if(options.isDefault)
                {   clip.isDefault = true;
                }


                if(!this.animationClips[modelType])
                {
                    this.animationClips[modelType] = {female: {}, male: {}};

                }

                this.animationClips[modelType][gender][actionName] = clip;
                    
            }

            

        }
        catch(err)
        {
            console.warn(`Error loading animation ${animationUrl}`, err)

        }

    }


    async addCharacter(meta, options)
    {
        let character = new ATARIA.Character(meta.modelUrl, {name: meta.name, gender: meta.gender, pollyConfig: this?.options?.pollyConfig}, {debug: options.debug}); 
        
        await character.init();
        this.characters[character.name] = character;


        for(let [actionName, clip] of Object.entries(this.animationClips[character.modelType][character.gender]))
        {
            character.addAction(actionName, clip, {isDefault: clip.isDefault});
            
        }


        this.scene.add(character.model);

        character.model.position.set(options?.position?.x ? options.position.x : 0, options?.position?.y ? options.position.y : 0, options?.position?.z ? options.position.z : 0);
        //character.model.rotateY(options.rotation ? THREE.MathUtils.degToRad(options.rotation) : 0);
        character.model.rotation.y = options.rotation ? THREE.MathUtils.degToRad(options.rotation) : 0;
        //character.model.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), options.rotation ? THREE.MathUtils.degToRad(options.rotation) : 0);
        this.debug(`Set character ${character.name} rotation to ${THREE.MathUtils.radToDeg(character.model.rotation.y)}`);

        if(options?.playDefaultAnimation)
        {
            character.performDefaultAction();

        }

    }


    async executeActionOnce(characterName, actionName, options)
    {
        await this.executeAction(characterName, actionName, {...options, once: true});

    }


    async executeAction(characterName, actionName, options)
    {
        if(actionName == "speak")
        {
            await this.characters[characterName].speak(options.phrase, options);

        }
        else
        {   
            await this.characters[characterName].performAction(actionName, options);

        }

    }


    cameraLookAt(characterName, options)
    {
        let character = this.characters[characterName];
        let distance = options?.distance ? options.distance : 1.3;

        //distance = distance * (THREE.MathUtils.radToDeg(character.model.rotation.y) < 180 ? -1 : 1);
        let characterRotationDegs = THREE.MathUtils.radToDeg(character.model.rotation.y) % 360;
        let characterRotation = character.model.rotation.y;
        //let xMultiplier = characterRotationDegs > 180 ? -1 : 1;
        //let zMultiplier = characterRotationDegs > 90 && characterRotationDegs < 270 ? -1 : 1;

        //let targetX = xMultiplier * (character.model.position.x + (distance * Math.sin(characterRotation)));
        //let targetZ = zMultiplier * (character.model.position.z + (distance * Math.cos(characterRotation)));
        
        // Find point from character position at character rotation angle at distance
        let targetZ = Math.cos(characterRotationDegs * Math.PI/180) * distance + character.model.position.z;
        let targetX = Math.sin(characterRotationDegs * Math.PI/180) * distance + character.model.position.x;
        
        let modelEyeHeight = [character.model.AVATURN, character.model.MODEL_TYPE_READY_PLAYER_ME].includes(character.modelType) ? 
            character.modelBody.eyeLeft.geometry.boundingBox.max.y : 1.4;
        
        let lookAtPosition = new THREE.Vector3(character.model.position.x, modelEyeHeight + 0.2, character.model.position.z);

        
        if(this.options.debug)
        {   
            this.addMarker({x: targetX, y: 0, z: targetZ}, characterRotation, "red");

        }


        this.camera.position.set(targetX, modelEyeHeight + 0.2, targetZ);
        this.camera.lookAt(lookAtPosition);

        this.debug(`Camera looking at character ${characterName} with camera coordinates ${JSON.stringify(this.camera.position)} and look at coordinates: ${JSON.stringify(lookAtPosition)}`);

    }


    cameraLookAtPair(characterName1, characterName2, options)
    {
        let character1 = this.characters[characterName1];
        let character2 = this.characters[characterName2];
        //let distance = options?.distance ? options.distance : 8.9;

        let midpointX = (character1.model.position.x + character2.model.position.x) / 2;
        let midpointZ = (character1.model.position.z + character2.model.position.z) / 2;
        let multiplier = THREE.MathUtils.radToDeg(character1.model.rotation.y) > 90 && THREE.MathUtils.radToDeg(character1.model.rotation.y) < 270 ? -1 : 1;
        //let multiplier = 1;
        
        this.debug(`Angle between characters ${characterName1} and ${characterName2}: `, 
            (Math.atan2(character1.model.position.x - character2.model.position.x, character1.model.position.z - character2.model.position.z) * 180 / Math.PI));
        
        let cameraRotationDegs = (multiplier * 90) + (Math.atan2(character1.model.position.x - character2.model.position.x, character1.model.position.z - character2.model.position.z) * 180 / Math.PI);
        //let cameraRotation = THREE.MathUtils.degToRad(cameraRotationDegs);

        let characterDistance = Math.sqrt((character2.model.position.x - character1.model.position.x)*(character2.model.position.x - character1.model.position.x) + 
            (character2.model.position.z - character1.model.position.z)*(character2.model.position.z - character1.model.position.z));

        let distance = characterDistance * options?.distanceFactor ? options.distanceFactor : 5;
        
        // Find point from midpoint at distance along calculated angle
        let targetZ = Math.cos(cameraRotationDegs * Math.PI/180) * distance + midpointZ;
        let targetX = Math.sin(cameraRotationDegs * Math.PI/180) * distance + midpointX;

        this.debug(`Midpoint between ${characterName1} and ${characterName2} is (${midpointX}, ${midpointZ}).  Camera rotation is ${cameraRotationDegs}.  Character distance is ${characterDistance}`);

        let modelEyeHeight = [character.model.AVATURN, character.model.MODEL_TYPE_READY_PLAYER_ME].includes(character1.modelType) ? 
            character1.modelBody.eyeLeft.geometry.boundingBox.max.y : 1.4;

        let lookAtPosition = new THREE.Vector3(midpointX, modelEyeHeight - 0.2, midpointZ);
        //let lookAtPosition = new THREE.Vector3(cube.position.x, modelEyeHeight, cube.position.z);

        this.camera.position.set(targetX, modelEyeHeight + 0.4, targetZ);
        this.camera.lookAt(lookAtPosition);

        this.debug(`Camera looking at characters ${characterName1} and ${characterName2} with camera coordinates ${JSON.stringify(this.camera.position)} and look at coordinates: ${JSON.stringify(lookAtPosition)}`);

    }


    faceEachother(characterName1, characterName2)
    {
        let character1 = this.characters[characterName1];
        let character2 = this.characters[characterName2];

        let midpointX = (character1.model.position.x + character2.model.position.x) / 2;
        let midpointZ = (character1.model.position.z + character2.model.position.z) / 2;
        
        character1.model.lookAt(new THREE.Vector3(midpointX, 0, midpointZ));
        character2.model.lookAt(new THREE.Vector3(midpointX, 0, midpointZ));

    }


    characterLookAt(characterName1, characterName2)
    {
        let character1 = this.characters[characterName1];
        let character2 = this.characters[characterName2];
        
        character1.modelSkeleton.Neck.lookAt(character2.model.position);

    }


    addMarker(position, rotation, color)
    {
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2); 
        const material = new THREE.MeshBasicMaterial({color: color}); 
        const cube = new THREE.Mesh(geometry, material); 
        
        this.scene.add(cube);
        cube.position.set(position.x, position.y, position.z);
        cube.rotation.y = rotation;

        this.debug("Added marker: ", cube);

    }


    debug(message, obj)
    {
        if(this.options.debug)
        {   
            if(obj)
            {   
                console.info(message, obj);

            }
            else
            {
                console.info(message);

            }

        }

    }

}


export { SceneManager };