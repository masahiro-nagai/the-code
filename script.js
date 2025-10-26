// 定数定義
const API_URL = 'https://api-inference.huggingface.co/models/Rakuten/RakutenAI-7B-instruct';

// 会話履歴を保持する配列
let conversationHistory = [];

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
const responseArea = document.getElementById('response-area');
const loading = document.getElementById('loading');

// システムプロンプトのテンプレート
const SYSTEM_PROMPT = `あなたは世界トップレベルのコーチ兼メンタルトレーナーです。
あなたの役割は、ユーザーが自分自身の内面と対話し、答えを見つける手助けをすることです。
以下の厳格なルールに従って、ユーザーに応答してください。

# ルール
- 決して直接的な「答え」や「解決策」を提示してはいけません。
- ユーザーの言葉を肯定し、共感を示してください。
- 常に、ユーザーが内省を深めるための「質問」で返答を締めくくってください。
- 専門用語を避け、穏やかで分かりやすい言葉を使ってください。
- ユーザーの最初の入力に対しては、まず自己紹介と役割を伝え、最初の質問を投げかけてください。
- 応答は200-300文字程度に簡潔にまとめてください。

`;

// イベントリスナーの設定
startButton.addEventListener('click', handleStart);
continueButton.addEventListener('click', handleContinue);
resetButton.addEventListener('click', handleReset);

// Enterキー + Shiftキーで送信（テキストエリア内）
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleStart();
    }
});

continueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleContinue();
    }
});

/**
 * 対話開始時の処理
 */
async function handleStart() {
    const userMessage = userInput.value.trim();
    const apiToken = apiTokenInput.value.trim();

    // バリデーション
    if (!userMessage) {
        alert('メッセージを入力してください。');
        return;
    }

    if (!apiToken) {
        alert('Hugging Face APIトークンを入力してください。');
        return;
    }

    // 画面を切り替え
    initialScreen.style.display = 'none';
    mainScreen.style.display = 'block';

    // 会話履歴に追加
    addMessageToHistory('user', userMessage);

    // AIに送信
    await callRakutenAI(userMessage, apiToken);
}

/**
 * 継続的な対話の処理
 */
async function handleContinue() {
    const userMessage = continueInput.value.trim();
    const apiToken = apiTokenInput.value.trim();

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

    // 入力欄をクリア
    continueInput.value = '';

    // AIに送信
    await callRakutenAI(userMessage, apiToken);
}

/**
 * リセット処理
 */
function handleReset() {
    // 会話履歴をクリア
    conversationHistory = [];
    conversationHistoryDiv.innerHTML = '';
    responseArea.innerHTML = '';
    userInput.value = '';
    continueInput.value = '';

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
 * Rakuten AI APIを呼び出す
 */
async function callRakutenAI(userMessage, apiToken) {
    // ローディング表示
    loading.classList.remove('hidden');

    try {
        // プロンプトの構築
        const formattedPrompt = buildPrompt(userMessage);

        // API リクエスト
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: formattedPrompt,
                parameters: {
                    max_new_tokens: 500,
                    temperature: 0.7,
                    top_p: 0.9,
                    do_sample: true
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        // レスポンスの処理
        let aiResponse = '';
        if (Array.isArray(data) && data.length > 0) {
            aiResponse = data[0].generated_text || '';
            
            // プロンプト部分を削除して、AIの応答のみを抽出
            aiResponse = extractAIResponse(aiResponse, formattedPrompt);
        } else if (data.generated_text) {
            aiResponse = data.generated_text;
            aiResponse = extractAIResponse(aiResponse, formattedPrompt);
        } else {
            throw new Error('予期しないレスポンス形式です。');
        }

        // 会話履歴に追加
        addMessageToHistory('ai', aiResponse);

    } catch (error) {
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
            const lastMessage = conversationHistoryDiv.lastChild;
            if (lastMessage) {
                conversationHistoryDiv.removeChild(lastMessage);
            }
        }
    } finally {
        // ローディング非表示
        loading.classList.add('hidden');
    }
}

/**
 * プロンプトを構築
 */
function buildPrompt(currentUserMessage) {
    // 会話履歴がある場合は、それを含める
    let conversationContext = '';
    
    // 最新の3往復分の会話のみを含める（コンテキストが長くなりすぎないように）
    const recentHistory = conversationHistory.slice(-6);
    
    if (recentHistory.length > 0) {
        conversationContext = '\n\n# これまでの会話:\n';
        recentHistory.forEach(msg => {
            const label = msg.role === 'user' ? 'ユーザー' : 'コーチ';
            conversationContext += `${label}: ${msg.content}\n`;
        });
    }

    const prompt = `${SYSTEM_PROMPT}${conversationContext}

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
    // プロンプト部分を削除
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

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('The Code アシスタントが起動しました。');
});

