// 定数定義
const API_URL = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium';

// 対話フェーズの定義
const PHASE = {
    EXPLORATION: 1,      // フェーズ1: 中心テーマの探求
    THEME_GENERATION: 2, // フェーズ2: 周辺テーマの生成
    SIMULATION: 3        // フェーズ3: 未来予測
};

// グローバル状態
let currentPhase = PHASE.EXPLORATION;
let conversationHistory = [];
let centralTheme = '';
let conversationCount = 0;
let apiToken = '';

// DOM要素の取得
const initialScreen = document.getElementById('initial-screen');
const mainScreen = document.getElementById('main-screen');
const userInput = document.getElementById('user-input');
const apiTokenInput = document.getElementById('api-token');
const startButton = document.getElementById('start-button');
const continueInput = document.getElementById('continue-input');
const continueButton = document.getElementById('continue-button');
const resetButton = document.getElementById('reset-button');
const conversationHistoryDiv = document.getElementById('conversation-history');
const mandalaChartContainer = document.getElementById('mandala-chart-container');
const simulationArea = document.getElementById('simulation-area');
const simulationContent = document.getElementById('simulation-content');
const inputArea = document.getElementById('input-area');
const loading = document.getElementById('loading');

// システムプロンプトのテンプレート

// フェーズ1: 中心テーマ探求用プロンプト
const PHASE1_PROMPT = `あなたは世界トップレベルのコーチ兼メンタルトレーナーです。
あなたの役割は、ユーザーが自分自身の内面と対話し、本当に目指したいことを見つける手助けをすることです。

# ルール
- 決して直接的な「答え」や「解決策」を提示してはいけません。
- ユーザーの言葉を肯定し、共感を示してください。
- 常に、ユーザーが内省を深めるための「質問」で返答を締めくくってください。
- 専門用語を避け、穏やかで分かりやすい言葉を使ってください。
- 応答は150-250文字程度に簡潔にまとめてください。

# 対話の目的
3-5回の対話を通じて、ユーザーが「本当にありたい姿」「達成したい核心」を言語化できるように導いてください。
`;

// フェーズ2: 8つの周辺テーマ生成用プロンプト
const PHASE2_PROMPT = `あなたは世界トップレベルの戦略プランナーです。
ユーザーとの対話の結果、中心となるテーマが「{central_theme}」に決まりました。

# あなたのタスク
この中心テーマ「{central_theme}」を達成するために不可欠な、8つの基本要素を提案してください。

# 出力形式の厳格なルール
- 回答は、必ず以下の形式で、番号付きリストのみを出力してください。
- 各項目は15文字以内の簡潔なキーワードにしてください。
- 各項目の前後に、余計な挨拶や説明文は一切含めないでください。
- 必ず8項目を生成してください。

1. [基本要素1]
2. [基本要素2]
3. [基本要素3]
4. [基本要素4]
5. [基本要素5]
6. [基本要素6]
7. [基本要素7]
8. [基本要素8]
`;

// フェーズ3: 未来予測シミュレーション用プロンプト
const PHASE3_PROMPT = `あなたは未来予測の専門家です。

# 中心テーマ
{central_theme}

# 8つの基本要素
{themes_list}

# あなたのタスク
上記の中心テーマと8つの基本要素がすべて達成された場合、ユーザーの人生や状況がどのように変化するかを、
具体的で感動的な未来の物語として300-400文字で描いてください。

# ルール
- 「〜になるでしょう」という予測形ではなく、「〜になっています」という現在形で書いてください。
- 具体的で視覚的にイメージできる表現を使ってください。
- ポジティブで希望に満ちた内容にしてください。
`;

// LocalStorageのキー
const STORAGE_KEY_TOKEN = 'the_code_hf_token';

// ページ読み込み時にトークンを復元
function loadSavedToken() {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (savedToken && apiTokenInput) {
        apiTokenInput.value = savedToken;
        apiToken = savedToken;
        console.log('保存されたAPIトークンを読み込みました');
    }
}

// トークンを保存
function saveToken(token) {
    if (token) {
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
        console.log('APIトークンを保存しました');
    }
}

// イベントリスナーを設定する関数
function setupEventListeners() {
    // ボタンのイベントリスナー
    if (startButton) {
        startButton.addEventListener('click', handleStart);
    }
    if (continueButton) {
        continueButton.addEventListener('click', handleContinue);
    }
    if (resetButton) {
        resetButton.addEventListener('click', handleReset);
    }

    // Enterキー + Shiftキーで送信
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                handleStart();
            }
        });
    }

    if (continueInput) {
        continueInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                handleContinue();
            }
        });
    }

    // APIトークン保存のイベントリスナー
    if (apiTokenInput) {
        apiTokenInput.addEventListener('change', () => {
            const token = apiTokenInput.value.trim();
            if (token) {
                saveToken(token);
            }
        });
    }
}

/**
 * 対話開始時の処理
 */
async function handleStart() {
    const userMessage = userInput.value.trim();
    const inputToken = apiTokenInput.value.trim();

    // バリデーション
    if (!userMessage) {
        alert('メッセージを入力してください。');
        return;
    }

    // トークンの取得と保存
    if (inputToken) {
        apiToken = inputToken;
        saveToken(apiToken);
    } else if (!apiToken) {
        alert('Hugging Face APIトークンを入力してください。\n一度入力すれば次回以降は自動的に使用されます。');
        return;
    }

    // 画面を切り替え
    initialScreen.style.display = 'none';
    mainScreen.style.display = 'block';

    // 会話履歴に追加
    addMessageToHistory('user', userMessage);
    conversationCount++;

    // AIに送信
    await callRakutenAI(userMessage);
}

/**
 * 継続的な対話の処理
 */
async function handleContinue() {
    const userMessage = continueInput.value.trim();

    if (!userMessage) {
        alert('メッセージを入力してください。');
        return;
    }

    if (!apiToken) {
        alert('APIトークンが設定されていません。最初からやり直してください。');
        handleReset();
        return;
    }

    // 会話履歴に追加
    addMessageToHistory('user', userMessage);
    conversationCount++;

    // 入力欄をクリア
    continueInput.value = '';

    // フェーズ1で3回以上対話したら、中心テーマ確定を提案
    if (currentPhase === PHASE.EXPLORATION && conversationCount >= 3) {
        // ユーザーのメッセージから中心テーマを抽出してフェーズ2へ
        await proposeThemeAndGenerate(userMessage);
    } else {
        // 通常の対話を続ける
        await callRakutenAI(userMessage);
    }
}

/**
 * 中心テーマを提案してフェーズ2へ移行
 */
async function proposeThemeAndGenerate(lastUserMessage) {
    // 簡易的に最後のユーザーメッセージから中心テーマを抽出
    // 実際のプロダクトでは、もっと高度な抽出ロジックが必要
    centralTheme = extractCentralTheme(lastUserMessage);
    
    // コーチからの提案メッセージ
    const proposalMessage = `お話を聞いていると、あなたの目指す核心は「${centralTheme}」ということかもしれませんね。\n\nこれを中心に据えて、具体的な地図（マンダラチャート）を描いてみませんか？`;
    
    addMessageToHistory('ai', proposalMessage);
    
    // 入力エリアを非表示にして自動的にフェーズ2へ
    inputArea.style.display = 'none';
    
    // 少し待ってからフェーズ2を開始
    setTimeout(async () => {
        currentPhase = PHASE.THEME_GENERATION;
        await generateMandalaChart();
    }, 2000);
}

/**
 * 中心テーマを抽出（簡易版）
 */
function extractCentralTheme(message) {
    // 会話履歴から重要なキーワードを抽出する簡易的な方法
    // 実際のプロダクトでは、AIを使ってより正確に抽出すべき
    
    // とりあえず、ユーザーの最後のメッセージから20文字程度を抽出
    let theme = message.substring(0, 30);
    
    // もし会話履歴に「〜になりたい」「〜を実現したい」などがあれば優先
    for (let msg of conversationHistory) {
        if (msg.role === 'user') {
            if (msg.content.includes('なりたい')) {
                const match = msg.content.match(/(.{5,20})なりたい/);
                if (match) theme = match[1] + 'になること';
            }
            if (msg.content.includes('実現したい')) {
                const match = msg.content.match(/(.{5,20})実現したい/);
                if (match) theme = match[1] + 'の実現';
            }
            if (msg.content.includes('目指')) {
                const match = msg.content.match(/(.{5,20})目指/);
                if (match) theme = match[1];
            }
        }
    }
    
    return theme.trim();
}

/**
 * マンダラチャートを生成
 */
async function generateMandalaChart() {
    loading.classList.remove('hidden');
    
    try {
        // AIに8つの周辺テーマを生成させる
        const prompt = PHASE2_PROMPT.replace('{central_theme}', centralTheme);
        const themes = await callRakutenAIForThemes(prompt);
        
        if (themes && themes.length === 8) {
            // マンダラチャートを表示
            displayMandalaChart(centralTheme, themes);
            
            // フェーズ3へ移行：未来予測シミュレーション
            currentPhase = PHASE.SIMULATION;
            await generateSimulation(themes);
        } else {
            throw new Error('テーマの生成に失敗しました');
        }
        
    } catch (error) {
        console.error('マンダラチャート生成エラー:', error);
        alert('マンダラチャートの生成中にエラーが発生しました。もう一度お試しください。');
        handleReset();
    } finally {
        loading.classList.add('hidden');
    }
}

/**
 * 未来予測シミュレーションを生成
 */
async function generateSimulation(themes) {
    loading.classList.remove('hidden');
    
    try {
        const themesList = themes.map((t, i) => `${i + 1}. ${t}`).join('\n');
        const prompt = PHASE3_PROMPT
            .replace('{central_theme}', centralTheme)
            .replace('{themes_list}', themesList);
        
        const simulation = await callRakutenAIForSimulation(prompt);
        
        // シミュレーション結果を表示
        simulationContent.textContent = simulation;
        simulationArea.classList.remove('hidden');
        
    } catch (error) {
        console.error('シミュレーション生成エラー:', error);
        // エラーでも続行可能
    } finally {
        loading.classList.add('hidden');
    }
}

/**
 * マンダラチャートを画面に表示
 */
function displayMandalaChart(center, themes) {
    // 中心セルに中心テーマを表示
    document.getElementById('cell-center').textContent = center;
    
    // 周辺8セルにテーマを表示
    for (let i = 1; i <= 8; i++) {
        document.getElementById(`cell-${i}`).textContent = themes[i - 1];
    }
    
    // マンダラチャートを表示
    mandalaChartContainer.classList.remove('hidden');
    
    // スムーズにスクロール
    mandalaChartContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * リセット処理
 */
function handleReset() {
    // 状態をリセット
    currentPhase = PHASE.EXPLORATION;
    conversationHistory = [];
    centralTheme = '';
    conversationCount = 0;
    apiToken = '';
    
    // DOMをクリア
    conversationHistoryDiv.innerHTML = '';
    continueInput.value = '';
    userInput.value = '';
    
    // マンダラチャートとシミュレーションを非表示
    mandalaChartContainer.classList.add('hidden');
    simulationArea.classList.add('hidden');
    
    // 入力エリアを表示
    inputArea.style.display = 'block';
    
    // 画面を切り替え
    mainScreen.style.display = 'none';
    initialScreen.style.display = 'block';
}

/**
 * 会話履歴にメッセージを追加
 */
function addMessageToHistory(role, content) {
    conversationHistory.push({ role, content });

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'message-label';
    labelDiv.textContent = role === 'user' ? 'あなた' : 'コーチ';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(labelDiv);
    messageDiv.appendChild(contentDiv);
    conversationHistoryDiv.appendChild(messageDiv);

    // スクロールを最下部に
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * Rakuten AI APIを呼び出す（通常の対話用）
 */
async function callRakutenAI(userMessage) {
    loading.classList.remove('hidden');

    try {
        const formattedPrompt = buildPrompt(userMessage, PHASE1_PROMPT);
        const response = await fetchAI(formattedPrompt);
        const aiResponse = extractAIResponse(response, formattedPrompt);
        
        addMessageToHistory('ai', aiResponse);

    } catch (error) {
        handleAPIError(error);
    } finally {
        loading.classList.add('hidden');
    }
}

/**
 * Rakuten AI APIを呼び出す（テーマ生成用）
 */
async function callRakutenAIForThemes(prompt) {
    const formattedPrompt = `[INST]\n${prompt}\n[/INST]`;
    const response = await fetchAI(formattedPrompt);
    
    // レスポンスから8つのテーマを抽出
    const themes = parseThemes(response);
    return themes;
}

/**
 * Rakuten AI APIを呼び出す（シミュレーション用）
 */
async function callRakutenAIForSimulation(prompt) {
    const formattedPrompt = `[INST]\n${prompt}\n[/INST]`;
    const response = await fetchAI(formattedPrompt);
    return extractAIResponse(response, formattedPrompt);
}

/**
 * AI APIへのリクエスト共通処理
 */
async function fetchAI(prompt) {
    console.log('API URL:', API_URL);
    console.log('API Token:', apiToken ? '設定済み' : '未設定');
    console.log('Prompt:', prompt.substring(0, 100) + '...');
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 500,
                temperature: 0.7,
                top_p: 0.9,
                do_sample: true
            }
        })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
            const errorText = await response.text();
            errorMessage += ` - ${errorText}`;
        } catch (e) {
            errorMessage += ` - レスポンスの読み取りに失敗`;
        }
        throw new Error(errorMessage);
    }

    const data = await response.json();
    
    let aiResponse = '';
    if (Array.isArray(data) && data.length > 0) {
        aiResponse = data[0].generated_text || '';
    } else if (data.generated_text) {
        aiResponse = data.generated_text;
    } else {
        throw new Error('予期しないレスポンス形式です。');
    }
    
    return aiResponse;
}

/**
 * プロンプトを構築
 */
function buildPrompt(currentUserMessage, systemPrompt) {
    let conversationContext = '';
    
    // 最新の3往復分の会話のみを含める
    const recentHistory = conversationHistory.slice(-6);
    
    if (recentHistory.length > 0) {
        conversationContext = '\n\n# これまでの会話:\n';
        recentHistory.forEach(msg => {
            const label = msg.role === 'user' ? 'ユーザー' : 'コーチ';
            conversationContext += `${label}: ${msg.content}\n`;
        });
    }

    const prompt = `${systemPrompt}${conversationContext}

[INST]
ユーザーの最新の入力は以下の通りです。
「${currentUserMessage}」

上記のルールに従って、コーチとして応答してください。
[/INST]`;

    return prompt;
}

/**
 * AIの応答のみを抽出
 */
function extractAIResponse(fullResponse, promptText) {
    let response = fullResponse;
    
    // [/INST]以降のテキストを抽出
    const instEndIndex = response.lastIndexOf('[/INST]');
    if (instEndIndex !== -1) {
        response = response.substring(instEndIndex + 7).trim();
    }
    
    // 余計な記号を削除
    response = response.replace(/^\s*[:：]\s*/, '');
    
    // 空の場合のフォールバック
    if (!response || response.length < 10) {
        response = 'すみません、うまく応答を生成できませんでした。別の言い方で教えていただけますか?';
    }
    
    return response.trim();
}

/**
 * レスポンスから8つのテーマを解析
 */
function parseThemes(response) {
    // [/INST]以降を取得
    let text = response;
    const instEndIndex = text.lastIndexOf('[/INST]');
    if (instEndIndex !== -1) {
        text = text.substring(instEndIndex + 7).trim();
    }
    
    // 番号付きリストを抽出
    const themes = [];
    const lines = text.split('\n');
    
    for (let line of lines) {
        // "1. テーマ" の形式をマッチ
        const match = line.match(/^\s*\d+\.\s*(.+)/);
        if (match) {
            let theme = match[1].trim();
            // []で囲まれている場合は除去
            theme = theme.replace(/^\[|\]$/g, '');
            themes.push(theme);
            
            if (themes.length === 8) break;
        }
    }
    
    // 8つ取得できなかった場合のフォールバック
    while (themes.length < 8) {
        themes.push(`要素${themes.length + 1}`);
    }
    
    return themes.slice(0, 8);
}

/**
 * APIエラーハンドリング
 */
function handleAPIError(error) {
    console.error('API呼び出しエラー:', error);
    
    let errorMessage = 'AIとの通信中にエラーが発生しました。\n';
    
    if (error.message.includes('401')) {
        errorMessage += 'APIトークンが無効です。正しいトークンを入力してください。';
    } else if (error.message.includes('503')) {
        errorMessage += 'モデルが現在読み込み中です。少し待ってから再度お試しください。';
    } else {
        errorMessage += `エラー詳細: ${error.message}`;
    }
    
    alert(errorMessage);
    
    // エラー時は最後のユーザーメッセージを削除
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
        conversationHistory.pop();
        conversationCount--;
        const lastMessage = conversationHistoryDiv.lastChild;
        if (lastMessage) {
            conversationHistoryDiv.removeChild(lastMessage);
        }
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('The Code アシスタントが起動しました。');
    console.log('フェーズ管理システム: 有効');
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // 保存されたAPIトークンを読み込み
    loadSavedToken();
    
    console.log('初期化完了');
});
