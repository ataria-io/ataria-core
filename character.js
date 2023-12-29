//import AWS from "https://cdn.jsdelivr.net/npm/aws-sdk@2.1526.0/+esm";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import * as ATARIA from "ataria";


class Character
{
    MODEL_TYPE_READY_PLAYER_ME = "readyPlayerMe";

    DEFAULT_CROSSFADE_SECS = 0.5;

    modelUrl = null;
    model = null;
    modelType = null;
    modelBody = {};
    modelSkeleton = {};
    morphManager = {};
    mixer = null;
    name = null;
    gender = null;
    scene = null;
    actionMap = null;
    actions = {};
    defaultActionName = null;
    currentActionName = null;
    pollyConfig = null;
    audioConfig = null;
    options


    constructor(modelUrl, args, options)
    {
        this.modelUrl = modelUrl;
        this.name = args.name;
        this.gender = args.gender;
        this.pollyConfig = args.pollyConfig;
        this.scene = args.scene;

        this.options = options;

    }


    async init()
    {
        await this.importModel();

    }


    async importModel()
    {   
        let loader = new GLTFLoader();
        let glb = await loader.loadAsync(this.modelUrl);

        this.model = glb.scene;
        this.mixer = new THREE.AnimationMixer(this.model);


        if(this.model.getObjectByName("Wolf3D_Head"))
        {
            this.debug(`Model ${this.modelUrl} is of type Ready Player Me`);

            this.modelType = this.MODEL_TYPE_READY_PLAYER_ME;

            this.actionMap = ATARIA.ACTION_MAP.readyPlayerMe;

            this.modelBody.root = this.model.getObjectByName("__root__");
            this.modelBody.head = this.model.getObjectByName("Wolf3D_Head");
            this.modelBody.eyeLeft = this.model.getObjectByName("EyeLeft");
            this.modelBody.eyeRight = this.model.getObjectByName("EyeRight");
            this.modelBody.teeth = this.model.getObjectByName("Wolf3D_Teeth");
            this.modelBody.body = this.model.getObjectByName("Wolf3D_Body");
            this.modelBody.outfitBottom = this.model.getObjectByName("Wolf3D_Outfit_Bottom");
            this.modelBody.footwear = this.model.getObjectByName("Wolf3D_Outfit_Footwear");
            this.modelBody.outfitTop = this.model.getObjectByName("Wolf3D_Outfit_Top");
            this.modelBody.hair = this.model.getObjectByName("Wolf3D_Hair");
            
            this.modelSkeleton.Neck = this.model.getObjectByName("Neck");

        }

        
        this.debug("Loaded model: ", this.model);

    }


    async addAction(actionName, animationClip, options)
    {
        let action = this.mixer.clipAction(animationClip);
        this.actions[actionName] = action;

        if(options?.isDefault)
        {
            this.defaultActionName = actionName;

        }

    }


    async performDefaultAction()
    {
        await this.performAction(this.defaultActionName);

    }


    async performActionOnce(actionName, options)
    {
        await this.performAction(actionName, {...options, once: true});

    }


    async performAction(actionName, options)
    {
        let _this = this;


        let action = this.actions[actionName];
        let crossfadeDuration = options?.crossFadeDuration ? options.crossFadeDuration : this.DEFAULT_CROSSFADE_SECS;

        this.debug(`${this.name} will perform action ${actionName}`, action)
        action.enabled = true;
        action.setLoop(options?.once ? THREE.LoopOnce : THREE.LoopRepeat);
        action.reset();
        action.play();


        if(!this.currentActionName)
        {
            this.currentActionName = actionName;
            this.actions[actionName].play();

        }
        else
        {
            this.actions[this.currentActionName].crossFadeTo(action, crossfadeDuration);
            this.currentActionName = actionName;

        }


        if(options?.once)
        {
            return new Promise((resolve) => 
                {
                    let clip = action.getClip();

                    setTimeout(() => 
                        {
                            resolve();

                        }, clip.duration > (crossfadeDuration + 0.1) ? (clip.duration - (crossfadeDuration + 0.1)) * 1000 : clip.duration * 1000);

                });

        }

    }


    async speak(phrase)
    {
        if(!this.pollyConfig)
        {
            console.warn(`Skipping speak "${phrase}" for character "${this.name}" as AWS Polly is not configured `);

            return;

        }


        let _this = this;


        let visemeMap = 
        {   k: "viseme_kk",
            a: "viseme_aa",
            T: "viseme_TH",
            E: "viseme_E",
            i: "viseme_I",
            o: "viseme_O",
            r: "viseme_RR",
            s: "viseme_SS",
            sil: "viseme_sil"
        }

        console.log("Polly: ", this.pollyConfig);


        let polly = new this.pollyConfig.AWS.Polly(
            {   signatureVersion: this.pollyConfig.signatureVersion,
                region: this.pollyConfig.region,
                accessKeyId: this.pollyConfig.accessKeyId,
                secretAccessKey: this.pollyConfig.secretAccessKey
            });
    
        let speechData = await polly.synthesizeSpeech(
            {   Text: phrase,
                OutputFormat: "mp3",
                VoiceId: "Joanna"           
            }).promise();

        this.debug("Polly data: ", speechData);

        let uInt8Array = new Uint8Array(speechData.AudioStream);
        let arrayBuffer = uInt8Array.buffer;
        let blob = new Blob([arrayBuffer]);
        let url = URL.createObjectURL(blob);

        let visemeData = await polly.synthesizeSpeech(
            {   Text: phrase,
                OutputFormat: "json",
                SpeechMarkTypes: ["viseme"],
                VoiceId: "Joanna"           
            }).promise();

        let decoder = new TextDecoder();
        let visemes = decoder.decode(visemeData.AudioStream).split("\n");
        this.debug("Viseme data: ", visemeData);
        this.debug("Viseme JSON: ", visemes);

        let audio = new Audio();
        audio.src = url;
        audio.load();


        let speechComplete = new Event("speechComplete");

        audio.onplaying = function()
        {
            setTimeout(
                function()
                {   
                    let lastVisemeTime = 0;


                    for(let visemeStr of visemes)
                    {   
                        if(!visemeStr)
                        {
                            continue;

                        }


                        let viseme = JSON.parse(visemeStr);
                        
                        
                        if(viseme.time > lastVisemeTime)
                        {   lastVisemeTime = viseme.time;
                        }


                        setTimeout(function()
                            {   
                                for(let i = 0; i < _this.modelBody.head.morphTargetInfluences.length; i++)
                                {   _this.modelBody.head.morphTargetInfluences[i] = 0                                    
                                }

                                _this.modelBody.head.morphTargetInfluences[_this.modelBody.head.morphTargetDictionary[visemeMap[viseme.value]]] = 0.5;
                                //_this.morphManager.head.morph(visemeMap[viseme.value], 0.5);                              
                            }, viseme.time);

                    }

                    //console.log(_this.modelBody.head.morphTargetInfluences);


                    setTimeout(() => 
                        {
                            for(let i = 0; i < _this.modelBody.head.morphTargetInfluences.length; i++)
                            {   _this.modelBody.head.morphTargetInfluences[i] = 0                                    
                            }

                            audio.dispatchEvent(speechComplete)

                        }, lastVisemeTime + 100)

                }, 0);

        }

        //audioPlayback.play();
        audio.play();


        return new Promise((resolve) => 
            {
                audio.addEventListener("speechComplete", (e) => 
                    {   setTimeout(() => {resolve();}, 400);
                    }, {once: true});

            });

    }


    _rotateModel(rotation)
    {
        for(let mesh of this.model.meshes)
        {   mesh.rotation.y += rotation;
        }

    }


    _rotateHead(rotation)
    {
        /*for(let part of ["head", "eyeLeft", "eyeRight", "teeth", "hair"])
        {
            //console.log(this.modelBody[part].animations);
            this.scene.beginAnimation(this.modelBody[part], 0, 30, false);

        }*/

        let skeleton = this.model.skeletons[0];
        let headBone = skeleton.bones[skeleton.getBoneIndexByName("Neck")];
        headBone.getTransformNode().rotate(BABYLON.Axis.Y, rotation, BABYLON.Space.LOCAL, this.model.meshes[0]);
        //this.scene.beginAnimation(headBone.getTransformNode(), 0, 30, false);
        //headBone.getTransformNode()
        console.log("Rotated");

    }


    *_animationBlending(fromAnimSpeedRatio, toAnim, toAnimSpeedRatio, repeat, speed)
    {
        let currentWeight = 1;
        let newWeight = 0;
        let fromAnim = this.currentAnimation;
        //console.log("From anim: ", fromAnim);
        //console.log("To anim: ", toAnim);

        //fromAnim.stop();
        toAnim.play(repeat);
        fromAnim.speedRatio = fromAnimSpeedRatio;
        toAnim.speedRatio = toAnimSpeedRatio;
        while(newWeight < 1)
        {
            newWeight += speed;
            currentWeight -= speed;
            toAnim.setWeightForAllAnimatables(newWeight);

            //fromAnim.setWeightForAllAnimatables(currentWeight);
            /*if(!persist)
            {   fromAnim.setWeightForAllAnimatables(currentWeight);
            }*/
            //this.rotateModel(-0.1);
            //console.log(this.model.meshes[0].rotation.y);
            yield;

        }

        this.currentAnimation = toAnim;
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


export { Character };