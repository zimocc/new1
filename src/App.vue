<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { data } from './data/data.js'

// 应用状态
const currentLessonIdx = ref(0)
const currentWordIdx = ref(0)
const showMeaning = ref(false)
const showModal = ref(false)
const isDictating = ref(false)
let dictationTimer = null

// 从 LocalStorage 加载数据
onMounted(() => {
  const savedLesson = localStorage.getItem('NCE_progress_lesson')
  const savedWord = localStorage.getItem('NCE_progress_word')
  if (savedLesson !== null) {
    currentLessonIdx.value = parseInt(savedLesson, 10)
  }
  if (savedWord !== null) {
    currentWordIdx.value = Math.min(parseInt(savedWord, 10), Math.max(data[currentLessonIdx.value]?.words.length - 1, 0))
  }
})

// 监听进度变化并保存 LocalStorage
watch([currentLessonIdx, currentWordIdx], () => {
  localStorage.setItem('NCE_progress_lesson', currentLessonIdx.value)
  localStorage.setItem('NCE_progress_word', currentWordIdx.value)
  showMeaning.value = false // 切换时默认隐藏意思
})

// 计算属性：全局统计
const totalCourses = computed(() => data.length)
const totalWords = computed(() => data.reduce((acc, curr) => acc + curr.words.length, 0))

// 计算当前到底学习了多少词，以估算总进度
const calculateProgressWords = () => {
  let count = 0
  for (let i = 0; i < currentLessonIdx.value; i++) {
    count += data[i].words.length
  }
  count += currentWordIdx.value + 1
  return count
}
const progressStr = computed(() => `${currentLessonIdx.value + 1}课/${calculateProgressWords()}词`)

// 课时与单词数据
const currentLessonData = computed(() => data[currentLessonIdx.value] || { name: '', words: [] })
const validWordList = computed(() => currentLessonData.value.words)
const currentWordData = computed(() => validWordList.value[currentWordIdx.value] || null)

// 词性映射表
const posMap = {
  'n.': '名词',
  'v.': '动词',
  'pron.': '代词',
  'adj.': '形容词',
  'adv.': '副词',
  'num.': '数词',
  'art.': '冠词',
  'prep.': '介词',
  'conj.': '连词',
  'int.': '感叹词',
  'phrase': '短语',
  'possessive adjective': '物主代词',
  'adj.&n.': '形&名'
}
const getPos = (p) => {
  if (!p) return ''
  return posMap[p] ? `${p} （${posMap[p]}）` : p
}

// 动态计算单词的适应性字体大小
const getWordStyle = Object.freeze((word) => {
  if (!word) return { fontSize: '55px' }
  const len = word.length
  if (len <= 8) return { fontSize: '55px' }
  if (len <= 15) return { fontSize: '40px' }
  if (len <= 20) return { fontSize: '30px' }
  return { fontSize: '24px' }
})

// 播放状态控制器
const isPlaying = ref(false)
let currentSpeechResolve = null

// 【核心修复】全局维护同一个 Audio 实例。防止手机浏览器由于严格审查自动播放策略而静音定时器内部实例
const globalAudio = new Audio()

globalAudio.addEventListener('ended', () => { 
  isPlaying.value = false 
  if (currentSpeechResolve) { currentSpeechResolve(); currentSpeechResolve = null; }
})
globalAudio.addEventListener('error', () => { 
  isPlaying.value = false 
  if (currentSpeechResolve) { currentSpeechResolve(); currentSpeechResolve = null; }
})

// 播放发音引擎（走 /api_tts 代理给百度语音），返回 Promise
const playSpeech = (text, forceOverride = false) => {
  return new Promise((resolve) => {
    if (!text) return resolve()
    if (isPlaying.value && !forceOverride) return resolve() // 手动点且正在播放时直接拒绝
    
    // 如果是听写模式强制覆盖播音，丢弃上一首的回调
    if (currentSpeechResolve) {
      currentSpeechResolve()
      currentSpeechResolve = null
    }

    isPlaying.value = true
    currentSpeechResolve = resolve
    const encoded = encodeURIComponent(text)
    globalAudio.src = `/api/tts?lan=en&text=${encoded}&spd=3`
    globalAudio.play().catch(e => {
      console.warn('发音接口未就绪或被浏览器拦截（需要用户先交互）:', e)
      isPlaying.value = false
      if (currentSpeechResolve) { currentSpeechResolve(); currentSpeechResolve = null; }
    })
  })
}

const toggleMeaning = () => {
  showMeaning.value = !showMeaning.value
}

const executeNext = () => {
  if (currentWordIdx.value < validWordList.value.length - 1) {
    currentWordIdx.value++
  } else if (currentLessonIdx.value < data.length - 1) {
    currentLessonIdx.value++
    currentWordIdx.value = 0
  }
}

const executePrev = () => {
  if (currentWordIdx.value > 0) {
    currentWordIdx.value--
  } else if (currentLessonIdx.value > 0) {
    currentLessonIdx.value--
    const prevWordsLength = data[currentLessonIdx.value].words.length
    currentWordIdx.value = prevWordsLength > 0 ? prevWordsLength - 1 : 0
  }
}

const nextWord = () => {
  if (isDictating.value) toggleDictation()
  executeNext()
}
const prevWord = () => {
  if (isDictating.value) toggleDictation()
  executePrev()
}
const selectWord = (idx) => {
  if (isDictating.value) toggleDictation()
  currentWordIdx.value = idx
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
let dictationInstance = 0

// 全新优化的循环听写控制器
const toggleDictation = async () => {
  if (isDictating.value) {
    // 强制关闭所有状态
    isDictating.value = false
    dictationInstance++
    globalAudio.pause()
    isPlaying.value = false
    if (currentSpeechResolve) { currentSpeechResolve(); currentSpeechResolve = null; }
  } else {
    isDictating.value = true
    const cycleId = ++dictationInstance
    
    // 维持当前批次的听写循环
    while (isDictating.value && dictationInstance === cycleId) {
      const currentWordText = currentWordData.value?.word
      if (!currentWordText) {
        isDictating.value = false
        break
      }
      
      // ① 每个单词连念 3 遍
      for (let i = 0; i < 3; i++) {
        if (!isDictating.value || dictationInstance !== cycleId) break
        
        await playSpeech(currentWordText, true) // 强制播放，等待播放完毕
        
        if (!isDictating.value || dictationInstance !== cycleId) break
        
        // ② 念完后间隔 2 秒（最后一次直接跑出去等 5 秒）
        if (i < 2) {
          await sleep(2000)
        }
      }
      
      if (!isDictating.value || dictationInstance !== cycleId) break
      
      // ③ 大间隔 5 秒
      await sleep(5000)
      
      if (!isDictating.value || dictationInstance !== cycleId) break
      
      executeNext()
    }
  }
}

const selectLesson = (idx) => {
  currentLessonIdx.value = idx
  currentWordIdx.value = 0
  showModal.value = false
  if (isDictating.value) toggleDictation() // 切换章节打断听写
}

const restartLesson = () => {
  currentWordIdx.value = 0
}

const openModal = async () => {
  showModal.value = true
  await nextTick()
  const activeEl = document.querySelector('.active-lesson')
  if (activeEl) {
    // 直接定位到当前选中的课程，取消平滑滚动动画
    activeEl.scrollIntoView({ behavior: 'auto', block: 'center' })
  }
}

const scrollModalToTop = () => {
  const modalListEl = document.querySelector('.modal-list')
  if (modalListEl) {
    modalListEl.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

</script>

<template>
  <div class="kid-app" v-if="data && data.length">
    
    <!-- 头部可爱统计板块 -->
    <header class="stats-grid">
      <div class="stat-box box-yellow">
        <span class="stat-icon">📖</span>
        <div class="stat-content">
          <span class="stat-label">当前教材</span>
          <span class="stat-value">新概念</span>
        </div>
      </div>
      <div class="stat-box box-pink">
        <span class="stat-icon">🌟</span>
        <div class="stat-content">
           <span class="stat-label">总课程数</span>
           <span class="stat-value">{{ totalCourses }}</span>
        </div>
      </div>
      <div class="stat-box box-blue">
        <span class="stat-icon">📝</span>
        <div class="stat-content">
           <span class="stat-label">词汇总数</span>
           <span class="stat-value">{{ totalWords }}</span>
        </div>
      </div>
      <div class="stat-box box-green">
        <span class="stat-icon">🚀</span>
        <div class="stat-content">
           <span class="stat-label">本猫进度</span>
           <span class="stat-value">{{ progressStr }}</span>
        </div>
      </div>
    </header>

    <!-- 学习主舞台 -->
    <main class="learning-section">
      <div class="header-tools">
        <button class="cute-btn btn-secondary" @click="openModal">📂 点我选课</button>
        <button class="cute-btn btn-danger" :class="{'btn-danger-active': isDictating}" @click="toggleDictation">
          {{ isDictating ? '⏹ 停止播放' : '▶️ 自动听写' }}
        </button>
      </div>

      <div class="main-card card-shadow">
        <!-- 左侧/右侧隐形点击区 -->
        <div class="tap-zone tap-left" @click="prevWord"></div>
        <div class="tap-zone tap-right" @click="nextWord"></div>

        <div class="lesson-badge">第 {{ currentLessonData.lesson }} 关</div>
        <h2 class="lesson-name">{{ currentLessonData.name || '闯关进行中...' }}</h2>

        <!-- 当前单词展示区 -->
        <div class="word-display" v-if="currentWordData">
          <h1 class="word-text" :style="getWordStyle(currentWordData.word)">{{ currentWordData.word }}</h1>
          <p class="word-phonetics">{{ currentWordData.phoneticSymbol }}</p>
          <div class="word-pos-tag">{{ getPos(currentWordData.partSpeech) }}</div>

          <button class="cute-btn btn-primary mt-15" :class="{'disabled-btn': isPlaying}" @click="playSpeech(currentWordData.word)">
            <template v-if="isPlaying">🔊 正在发音...</template>
            <template v-else>🔊 点我听发音</template>
          </button>

          <!-- 神秘翻译盒子 -->
          <div class="meaning-box" @click="toggleMeaning" :class="{'revealed': showMeaning}">
            <span v-if="!showMeaning" class="mystery-text">👆 点击这里，揭开中文秘密！</span>
            <span v-else class="meaning-text">{{ currentWordData.cn }}</span>
          </div>
        </div>
        <div class="word-display empty-display" v-else>
          <span class="empty-icon">🎈</span>
          <p>太棒啦！这节课没有新单词哦～快去下一关！</p>
        </div>

        <!-- 导航操作栏 -->
        <div class="actions-row">
          <button class="cute-btn btn-action" @click="prevWord">⬅️ 上一个</button>
          <button class="cute-btn btn-action" @click="nextWord">下一个 ➡️</button>
        </div>
      </div>
      
    </main>

    <!-- 课文词汇小跟班 -->
    <section class="list-section">
      <h2 class="section-title">🎒 本课的单词小伙伴</h2>
      <div class="list-scroll-container">
        <div class="word-list-box card-shadow" v-for="(item, idx) in validWordList" :key="idx" 
             :class="{'active-word': idx === currentWordIdx}"
             @click="selectWord(idx)">
          <div class="word-list-left">
            <p class="list-word">{{ item.word }}</p>
            <p class="list-phonetics">{{ item.phoneticSymbol }}</p>
          </div>
          <div class="play-icon" @click.stop="playSpeech(item.word)">🎵</div>
        </div>
      </div>
    </section>

    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-content card-shadow">
        
        <!-- 一键置顶悬浮按钮 -->
        <button class="cute-btn btn-secondary fab-top-btn" @click="scrollModalToTop">⬆️</button>

        <div class="modal-header">
          <h3>🎊 挑选你想学的关卡吧 🎊</h3>
          <button class="cute-btn btn-danger close-btn" @click="showModal = false">✖</button>
        </div>
        <div class="modal-list">
          <div v-for="(lessonItem, index) in data" :key="index" 
               class="modal-item"
               :class="{'active-lesson': index === currentLessonIdx}"
               @click="selectLesson(index)">
             <span class="level-icon">⭐</span>
             <span class="level-name">Lesson {{ lessonItem.lesson }} ({{ lessonItem.words.length }} 词)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 整个页面使用欢快的纸面质感圆点背景 */
html, body {
  margin: 0;
  padding: 0;
  background-color: #f0faff;
  background-image: radial-gradient(#d1edfc 20%, transparent 20%), radial-gradient(#d1edfc 20%, transparent 20%);
  background-position: 0 0, 25px 25px;
  background-size: 50px 50px;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #2c3e50; 
  -webkit-tap-highlight-color: transparent;
}

* { box-sizing: border-box; }

.kid-app {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 儿童流行风格：粗黑边框、坚实投影 (Neo-brutalism) */
.card-shadow {
  background-color: #ffffff;
  border: 4px solid #3d405b;
  border-radius: 20px;
  box-shadow: 0 6px 0 #3d405b;
}

/* === 顶部四宫格 === */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.stat-box {
  border: 4px solid #3d405b;
  border-radius: 16px;
  box-shadow: 0 4px 0 #3d405b;
  padding: 10px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.box-yellow { background-color: #ffeaa7; }
.box-pink { background-color: #fab1a0; }
.box-blue { background-color: #81ecec; }
.box-green { background-color: #55efc4; }

.stat-icon { font-size: 24px; }
.stat-content { display: flex; flex-direction: column; white-space: nowrap; }
.stat-label { font-size: 13px; color: #3d405b; font-weight: 900; }
.stat-value { font-size: 17px; font-weight: 900; color: #d63031; }


/* === 中间发音与学习区 === */
.learning-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.header-tools {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

/* 所有的按钮使用类似糖果的质感 */
.cute-btn {
  font-family: inherit;
  border: 4px solid #3d405b;
  border-radius: 16px;
  font-weight: 900;
  font-size: 16px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.1s ease;
  flex: 1;
  text-align: center;
}
.cute-btn:active {
  transform: translateY(5px);
  box-shadow: 0 0 0 #3d405b !important;
}
.btn-primary {
  background-color: #74b9ff; color: #fff; text-shadow: 1px 1px 0px #0984e3;
  box-shadow: 0 5px 0 #3d405b; 
}
.btn-secondary {
  background-color: #a8e6cf; color: #3d405b;
  box-shadow: 0 5px 0 #3d405b;
}
.btn-danger {
  background-color: #ff7675; color: #fff; text-shadow: 1px 1px 0px #d63031;
  box-shadow: 0 5px 0 #3d405b;
}
.btn-danger-active {
  background-color: #d63031;
  box-shadow: 0 0px 0 #3d405b !important;
  transform: translateY(5px);
}
.btn-action {
  background-color: #a29bfe; color: #fff; text-shadow: 1px 1px 0px #6c5ce7;
  box-shadow: 0 5px 0 #3d405b;
}
.disabled-btn {
  background-color: #b2bec3 !important;
  box-shadow: 0 5px 0 #636e72 !important;
  color: #fff !important;
  cursor: not-allowed;
  border-color: #636e72 !important;
  pointer-events: none;
}

/* 主展示卡片 */
.main-card {
  padding: 30px 20px 20px 20px;
  text-align: center;
  position: relative;
}
.lesson-badge {
  position: absolute;
  top: -15px; left: -10px;
  background-color: #ffeaa7; color: #d35400; font-weight: 900;
  padding: 5px 25px; transform: rotate(-5deg);
  border: 4px solid #3d405b; box-shadow: 3px 3px 0 #3d405b;
  border-radius: 8px; z-index: 2; font-size: 18px;
}
.lesson-name {
  margin-top: 15px; font-size: 24px; color: #2d3436;
  text-decoration: underline; text-decoration-color: #a29bfe; text-decoration-thickness: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; padding: 0 10px;
}

.word-display {
  margin-top: 25px;
  display: flex; flex-direction: column; align-items: center;
}
.word-text {
  font-weight: 900; color: #3d405b;
  margin: 0; text-shadow: 3px 3px 0px #fdcb6e;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%; padding: 0 10px;
  /* 增加固定高度和居中，绝不存在高度抖动 */
  height: 75px; display: flex; align-items: center; justify-content: center;
}
.word-phonetics {
  font-size: 22px; color: #636e72; font-weight: bold; margin: 5px 0 15px;
  /* 锁定音标外壳尺寸，防字母下沉抖动 */
  line-height: 26px; height: 26px; white-space: nowrap;
}
.word-pos-tag {
  background-color: #81ecec; color: #00b894;
  padding: 6px 16px; border-radius: 12px; font-weight: 900;
  border: 3px solid #00b894; font-size: 14px;
  /* 防止过长（如物主代词英文）折行导致高度暴增 */
  white-space: nowrap; max-width: 95%; overflow: hidden; text-overflow: ellipsis;
}
.mt-15 { margin-top: 25px; width: 80%; font-size: 18px!important; position: relative; z-index: 10; }

/* 捉迷藏翻转区 */
.meaning-box {
  margin-top: 25px;
  background-color: #dfe6e9; border: 4px dashed #b2bec3;
  border-radius: 16px; width: 100%; padding: 0 10px;
  height: 95px; /* 固定高度，不再使用伸缩高度 */
  cursor: pointer; position: relative; z-index: 10; /* 高层级盖住两侧隐形区 */
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.meaning-box:active { transform: scale(0.95); }
.meaning-box.revealed {
  background-color: #fffbdf; border: 4px solid #f39c12;
  box-shadow: 0 4px 0px #f39c12;
}
.mystery-text { font-weight: 900; color: #636e72; font-size: 16px; }
.meaning-text { font-size: 26px; font-weight: 900; color: #d35400; }

.empty-display { padding: 40px 0; }
.empty-icon { font-size: 60px; margin-bottom: 20px;}

.actions-row { margin-top: 25px; display: flex; gap: 15px; position: relative; z-index: 10; }

/* 两侧隐形点击切换热区 */
.tap-zone {
  position: absolute;
  top: 0; bottom: 0;
  width: 25%;
  z-index: 5; /* 保证它位于卡片底部上方，但是被中心按钮盖住 */
  cursor: pointer;
}
.tap-left { left: 0; }
.tap-right { right: 0; }

/* === 词表大集合 === */
.section-title {
  font-size: 22px; font-weight: 900; color: #3d405b; margin-bottom: 20px;
  text-shadow: 2px 2px 0px #fff;
}
.list-scroll-container {
  max-height: 350px;
  overflow-y: auto;
  padding-right: 5px;
  /* 平滑的滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #b2bec3 transparent;
}
.list-scroll-container::-webkit-scrollbar { width: 6px; }
.list-scroll-container::-webkit-scrollbar-thumb { background: #b2bec3; border-radius: 4px; }

.word-list-box {
  display: flex; justify-content: space-between; align-items: center;
  padding: 15px 20px; margin-bottom: 15px;
  cursor: pointer; transition: transform 0.1s;
}
.word-list-box:active { transform: scale(0.98); }
.active-word {
  background-color: #ffeaa7; border-color: #3d405b; box-shadow: 0 4px 0 #3d405b;
}
.list-word { font-weight: 900; font-size: 22px; color: #2d3436; margin: 0 0 5px; }
.list-phonetics { color: #636e72; font-size: 15px; font-weight: bold; margin: 0; }
.play-icon { font-size: 32px; filter: drop-shadow(2px 2px 0px rgba(0,0,0,0.2)); transition: 0.1s;}
.play-icon:active { transform: scale(0.8); }

/* === 选课巨星登场 === */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(61, 64, 91, 0.7);
  display: flex; justify-content: center; align-items: center; z-index: 999;
  backdrop-filter: blur(4px);
}
.modal-content {
  width: 90%; max-width: 450px; max-height: 80vh;
  display: flex; flex-direction: column; overflow: hidden;
  position: relative; /* 为内部的绝对定位按钮提供参考 */
}
/* 悬浮置顶按钮 */
.fab-top-btn {
  position: absolute;
  bottom: 25px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  z-index: 50;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px; border-bottom: 4px solid #3d405b;
  background: #81ecec;
}
.modal-header h3 { margin: 0; font-weight: 900; color: #3d405b; font-size: 18px; white-space: nowrap;}
.close-btn { flex: none; padding: 5px 15px; font-size: 22px; margin-left: 10px; }

.modal-list {
  padding: 20px; overflow-y: auto; background: #fff;
}
.modal-item {
  padding: 15px; border: 4px solid #dfe6e9; border-radius: 16px;
  margin-bottom: 12px; font-weight: 900; font-size: 18px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; color: #2d3436;
}
.modal-item:active { transform: scale(0.98); }
.active-lesson {
  border-color: #3d405b; background-color: #74b9ff; color: #fff;
  box-shadow: 0 4px 0 #3d405b;
}
</style>
