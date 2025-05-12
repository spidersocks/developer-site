// src/apps/EightHundredCalculator/translations.js

const translations = {
    en: {
      // Titles & Descriptions
      title: "800m Training & Race Calculator",
      metaTitle: "800m Training Calculator | Predict Race Splits & Times",
      metaDescription: "Free 800m calculator to predict 800 meter race times and recommended splits from your training. Ideal for runners, athletes, and coaches.",
      metaImage: "https://www.seanfontaine.dev/og-800m.png",
      metaUrl: "https://www.seanfontaine.dev/800m-calculator",
  
      // UI elements
      predictTab: "Predict Race Time",
      reverseTab: "Get Training Splits",
      trainingType: "Training Type",
      showTrainingInfo: "Show Training Info",
      hideTrainingInfo: "Hide Training Info",
      restTimes: "Rest Times",
      inputAverages: "Input Averages",
      goal800mTime: "Goal 800m Time",
      calculate: "Calculate",
      calculating: "Calculating...",
      predictedTime: "Predicted 800m Time:",
      recommendedSplits: "Recommended Splits:",
      copyright: "@2025 Sean-Fontaine-Tools",
  
      // Error messages
      predictionError: "Prediction failed. Please check inputs.",
      splitError: "Split calculation failed. Please check goal time.",
      genericError: "An error occurred.",
  
      // Placeholders
      defaultPlaceholder: "1:32.5",
      goalPlaceholder: "2:00.0",
  
      // Training types (labels and rests, for dropdown)
      trainingTypes: [
        {
          key: "600m_x3",
          label: "3 x 600m",
          rest: "20 minutes rest between each 600m.",
          features: [
            { key: "First 600m", label: "First 600m" },
            { key: "Second 600m", label: "Second 600m" },
            { key: "Third 600m", label: "Third 600m" },
          ],
        },
        {
          key: "600m_400m_x3",
          label: "600m + 3 x 400m",
          rest: "8 minutes rest after the 600m. 2.5 minutes rest between each 400m.",
          features: [
            { key: "600m", label: "600m" },
            { key: "3x400m average", label: "3x400m average" },
          ],
        },
        {
          key: "600m_300m_x4",
          label: "600m + 4 x 300m",
          rest: "8 minutes rest after the 600m. 3 minutes rest between each 300m.",
          features: [
            { key: "600m", label: "600m" },
            { key: "4x300m average", label: "4x300m average" },
          ],
        },
        {
          key: "500m_x3",
          label: "3 x 500m",
          rest: "10 minutes rest between each 500m.",
          features: [
            { key: "First 500m", label: "First 500m" },
            { key: "Second 500m", label: "Second 500m" },
            { key: "Third 500m", label: "Third 500m" },
          ],
        },
        {
          key: "ladder",
          label: "300-400-500-400-300-200m Ladder",
          rest: "300m (rest 4 min), 400m (rest 5 min), 500m (rest 5 min), 400m (rest 4 min), 300m (rest 3 min), 200m.",
          features: [
            { key: "300m_avg", label: "300m" },
            { key: "400m_avg", label: "400m" },
            { key: "500m", label: "500m" },
            { key: "200m", label: "200m" }
          ],
        },
        {
          key: "300m_x3x2",
          label: "2 x (3 x 300m)",
          rest: "3 minutes rest between each 300m. 10 minutes between set 1 and set 2.",
          features: [
            { key: "Set 1 3x300m average", label: "Set 1 3x300m average" },
            { key: "Set 2 3x300m average", label: "Set 2 3x300m average" },
          ],
        },
        {
          key: "200m_x8",
          label: "8 x 200m",
          rest: "Jogged 90 seconds active recovery between each 200m.",
          features: [
            { key: "First 200m", label: "First 200m" },
            { key: "Second 200m", label: "Second 200m" },
            { key: "Third 200m", label: "Third 200m" },
            { key: "Fourth 200m", label: "Fourth 200m" },
            { key: "Fifth 200m", label: "Fifth 200m" },
            { key: "Sixth 200m", label: "Sixth 200m" },
            { key: "Seventh 200m", label: "Seventh 200m" },
            { key: "Eighth 200m", label: "Eighth 200m" }
          ]
        }
      ],
      // -- NEW: PROMPTS --
      prompts: {
        "600m_x3": [
          { split: "First 600m Split", average: "3 x 600m Average Split" },
          { split: "Second 600m Split", average: "3 x 600m Average Split" },
          { split: "Third 600m Split", average: "3 x 600m Average Split" },
        ],
        "600m_400m_x3": [
          { split: "600m Split", average: "600m Average Split" },
          { split: "3x400m Splits", average: "3x400m Average Split" },
        ],
        "600m_300m_x4": [
          { split: "600m Split", average: "600m Average Split" },
          { split: "4x300m Splits", average: "4x300m Average Split" },
        ],
        "500m_x3": [
          { split: "First 500m Split", average: "3 x 500m Average Split" },
          { split: "Second 500m Split", average: "3 x 500m Average Split" },
          { split: "Third 500m Split", average: "3 x 500m Average Split" },
        ],
        "ladder": [
          { split: "300m Splits", average: "300m Average" },
          { split: "400m Splits", average: "400m Average" },
          { split: "500m Split", average: "500m" },
          { split: "200m Split", average: "200m" }
        ],
        "300m_x3x2": [
          { split: "Set 1 300m Splits", average: "Set 1 3x300m Average" },
          { split: "Set 2 300m Splits", average: "Set 2 3x300m Average" },
        ],
        "200m_x8": [
          { split: "First 200m", average: "8 x 200m Average" },
          { split: "Second 200m", average: "8 x 200m Average" },
          { split: "Third 200m", average: "8 x 200m Average" },
          { split: "Fourth 200m", average: "8 x 200m Average" },
          { split: "Fifth 200m", average: "8 x 200m Average" },
          { split: "Sixth 200m", average: "8 x 200m Average" },
          { split: "Seventh 200m", average: "8 x 200m Average" },
          { split: "Eighth 200m", average: "8 x 200m Average" }
        ]
      },
      splitLabels: {
        "600m": "600m",
        "500m": "500m",
        "First 600m": "First 600m",
        "Second 600m": "Second 600m",
        "Third 600m": "Third 600m",
        "First 500m": "First 500m",
        "Second 500m": "Second 500m",
        "Third 500m": "Third 500m",
        "3x400m average": "3x400m average",
        "4x300m average": "4x300m average",
        "Set 1 3x300m average": "Set 1 3x300m average",
        "Set 2 3x300m average": "Set 2 3x300m average",
        "First 300m": "First 300m",
        "Second 300m": "Second 300m",
        "First 400m": "First 400m",
        "Second 400m": "Second 400m",
        "500m": "500m",
        "200m": "200m",
        "8x200m average": "8x200m average",
        "First 200m": "First 200m",
        "Second 200m": "Second 200m",
        "Third 200m": "Third 200m",
        "Fourth 200m": "Fourth 200m",
        "Fifth 200m": "Fifth 200m",
        "Sixth 200m": "Sixth 200m",
        "Seventh 200m": "Seventh 200m",
        "Eighth 200m": "Eighth 200m"
      },
    },
  
  
    zh: {
      // Titles & Descriptions
      title: "800米訓練與比賽計算器",
      metaTitle: "800米訓練計算器｜預測比賽分段與成績",
      metaDescription: "免費800米計算器，根據訓練成績預測比賽時間和建議分段。適合跑手、運動員及教練使用。",
      metaImage: "https://www.seanfontaine.dev/og-800m.png",
      metaUrl: "https://www.seanfontaine.dev/800m-calculator",
  
      // UI elements
      predictTab: "預測比賽時間",
      reverseTab: "分段建議計算",
      trainingType: "訓練類型",
      showTrainingInfo: "顯示訓練資料",
      hideTrainingInfo: "隱藏訓練資料",
      restTimes: "休息時間",
      inputAverages: "輸入平均值",
      goal800mTime: "目標800米時間",
      calculate: "計算",
      calculating: "計算中...",
      predictedTime: "預測800米時間：",
      recommendedSplits: "建議分段：",
      copyright: "@2025 Sean-Fontaine-Tools",
  
      // Error messages
      predictionError: "預測失敗。請檢查輸入資料。",
      splitError: "分段計算失敗。請檢查目標時間。",
      genericError: "發生錯誤。",
  
      // Placeholders
      defaultPlaceholder: "1:32.5",
      goalPlaceholder: "2:00.0",
  
      // Training types (labels and rests, for dropdown)
      trainingTypes: [
        {
          key: "600m_x3",
          label: "3 x 600米",
          rest: "每組600米之間休息20分鐘。",
          features: [
            { key: "First 600m", label: "第一組600米" },
            { key: "Second 600m", label: "第二組600米" },
            { key: "Third 600m", label: "第三組600米" },
          ],
        },
        {
          key: "600m_400m_x3",
          label: "600米 + 3 x 400米",
          rest: "600米後休息8分鐘。每組400米之間休息2.5分鐘。",
          features: [
            { key: "600m", label: "600米" },
            { key: "3x400m average", label: "3x400米平均" },
          ],
        },
        {
          key: "600m_300m_x4",
          label: "600米 + 4 x 300米",
          rest: "600米後休息8分鐘。每組300米之間休息3分鐘。",
          features: [
            { key: "600m", label: "600米" },
            { key: "4x300m average", label: "4x300米平均" },
          ],
        },
        {
          key: "500m_x3",
          label: "3 x 500米",
          rest: "每組500米之間休息10分鐘。",
          features: [
            { key: "First 500m", label: "第一組500米" },
            { key: "Second 500m", label: "第二組500米" },
            { key: "Third 500m", label: "第三組500米" },
          ],
        },
        {
          key: "ladder",
          label: "300-400-500-400-300-200米階梯",
          rest: "300米（休4分鐘）、400米（休5分鐘）、500米（休5分鐘）、400米（休4分鐘）、300米（休3分鐘）、200米。",
          features: [
            { key: "300m_avg", label: "300米" },
            { key: "400m_avg", label: "400米" },
            { key: "500m", label: "500米" },
            { key: "200m", label: "200米" }
          ],
        },
        {
          key: "300m_x3x2",
          label: "2 x (3 x 300米)",
          rest: "每組300米之間休息3分鐘。第一組及第二組之間休息10分鐘。",
          features: [
            { key: "Set 1 3x300m average", label: "第一組3x300米平均" },
            { key: "Set 2 3x300m average", label: "第二組3x300米平均" },
          ],
        },
        {
          key: "200m_x8",
          label: "8 x 200米",
          rest: "每組200米之間慢跑200米（90秒）。",
          features: [
            { key: "First 200m", label: "第一組200米" },
            { key: "Second 200m", label: "第二組200米" },
            { key: "Third 200m", label: "第三組200米" },
            { key: "Fourth 200m", label: "第四組200米" },
            { key: "Fifth 200m", label: "第五組200米" },
            { key: "Sixth 200m", label: "第六組200米" },
            { key: "Seventh 200m", label: "第七組200米" },
            { key: "Eighth 200m", label: "第八組200米" }
          ]
        }
      ],
      // -- NEW: PROMPTS --
      prompts: {
        "600m_x3": [
          { split: "第一組600米分段", average: "3 x 600米平均分段" },
          { split: "第二組600米分段", average: "3 x 600米平均分段" },
          { split: "第三組600米分段", average: "3 x 600米平均分段" },
        ],
        "600m_400m_x3": [
          { split: "600米分段", average: "600米平均分段" },
          { split: "3x400米分段", average: "3x400米平均分段" },
        ],
        "600m_300m_x4": [
          { split: "600米分段", average: "600米平均分段" },
          { split: "4x300米分段", average: "4x300米平均分段" },
        ],
        "500m_x3": [
          { split: "第一組500米分段", average: "3 x 500米平均分段" },
          { split: "第二組500米分段", average: "3 x 500米平均分段" },
          { split: "第三組500米分段", average: "3 x 500米平均分段" },
        ],
        "ladder": [
          { split: "300米分段", average: "300米平均" },
          { split: "400米分段", average: "400米平均" },
          { split: "500米分段", average: "500米" },
          { split: "200米分段", average: "200米" }
        ],
        "300m_x3x2": [
          { split: "第1組3x300米分段", average: "第1組3x300米平均" },
          { split: "第2組3x300米分段", average: "第2組3x300米平均" },
        ],
        "200m_x8": [
          { split: "第一組200米", average: "8 x 200米平均" },
          { split: "第二組200米", average: "8 x 200米平均" },
          { split: "第三組200米", average: "8 x 200米平均" },
          { split: "第四組200米", average: "8 x 200米平均" },
          { split: "第五組200米", average: "8 x 200米平均" },
          { split: "第六組200米", average: "8 x 200米平均" },
          { split: "第七組200米", average: "8 x 200米平均" },
          { split: "第八組200米", average: "8 x 200米平均" }
        ]
      },
      splitLabels: {
        "600m": "600米",
        "500m": "500米",
        "First 600m": "第一組600米分段",
        "Second 600m": "第二組600米分段",
        "Third 600m": "第三組600米分段",
        "First 500m": "第一組500米分段",
        "Second 500m": "第二組500米分段",
        "Third 500m": "第三組500米分段",
        "3x400m average": "3x400米平均分段",
        "4x300m average": "4x300米平均分段",
        "Set 1 3x300m average": "第一組3x300米平均分段",
        "Set 2 3x300m average": "第二組3x300米平均分段",
        "First 300m": "第一組300米",
        "Second 300m": "第二組300米",
        "First 400m": "第一組400米",
        "Second 400m": "第二組400米",
        "500m": "500米",
        "200m": "200米",
        "8x200m average": "8x200米平均",
        "First 200m": "第一組200米",
        "Second 200m": "第二組200米",
        "Third 200m": "第三組200米",
        "Fourth 200m": "第四組200米",
        "Fifth 200m": "第五組200米",
        "Sixth 200m": "第六組200米",
        "Seventh 200m": "第七組200米",
        "Eighth 200m": "第八組200米",
      },
    },
  };
  
  export default translations;