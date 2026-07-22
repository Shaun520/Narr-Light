insert into public.system_configs (key, value, description)
values
  (
    'generation_spec',
    '{
      "baseWordsPerHour": 7500,
      "characterScriptShare": 0.62,
      "characterScriptMode": "single",
      "customScriptsPerPlayer": 1,
      "minScenesPerAct": 3,
      "minCluesPerRoundBase": 4,
      "playerClueRatio": 0.8,
      "durationBands": [
        { "minDuration": 2, "maxDuration": 3, "actCount": 3, "searchRoundCount": 3 },
        { "minDuration": 3, "maxDuration": 5, "actCount": 4, "searchRoundCount": 4 },
        { "minDuration": 5, "maxDuration": 7, "actCount": 5, "searchRoundCount": 5 },
        { "minDuration": 7, "maxDuration": 8, "actCount": 6, "searchRoundCount": 6 }
      ],
      "difficultyMultipliers": {
        "beginner": 0.85,
        "intermediate": 1,
        "advanced": 1.15,
        "expert": 1.3
      },
      "genreMultipliers": {
        "hardcore": 1.15,
        "emotion": 1.05,
        "horror": 1,
        "funny": 0.95,
        "mechanism": 1.1
      }
    }'::jsonb,
    '剧本生成规格控制（时长、结构、线索与字数）'
  )
on conflict (key) do nothing;
