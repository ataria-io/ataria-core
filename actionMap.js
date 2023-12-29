
const baseUrl = "https://raw.githubusercontent.com/jasondalycanpk/readyplayerme-animations-glb/main";


const ACTION_MAP = 
{
    readyPlayerMe:
    {
        female:
        {   idle: 
            {   url: `${baseUrl}/animation-library-glb/feminine/idle/F_Standing_Idle_001.glb`,
                source: "readyPlayerMe",
                isDefault: true
            },
            talk: 
            {   url: `${baseUrl}/animation-library-glb/feminine/expression/F_Talking_Variations_001.glb`,
                source: "readyPlayerMe"
            },
            walk:
            {   url: `${baseUrl}/animation-library-glb/feminine/locomotion/F_Walk_003.glb`,
                source: "readyPlayerMe"
            },
            run:
            {   url: `${baseUrl}/animation-library-glb/feminine/locomotion/F_Run_001.glb`,
                source: "readyPlayerMe"
            }
        }

    }

}


export { ACTION_MAP };