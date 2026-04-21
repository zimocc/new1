<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { data } from './data/data.js'

// 应用状态
const currentLessonIdx = ref(0)
const currentWordIdx = ref(0)
const showMeaning = ref(false)
const showModal = ref(false)
const showHelpModal = ref(false)
const isDictating = ref(false)
const autoPlayEnabled = ref(false)
let dictationTimer = null
let isReadyForAutoPlay = false

// 从 LocalStorage 加载数据
onMounted(async () => {
  const savedLesson = localStorage.getItem('NCE_progress_lesson')
  const savedWord = localStorage.getItem('NCE_progress_word')
  const savedAutoPlay = localStorage.getItem('NCE_auto_play_enabled')
  const savedHelpShown = localStorage.getItem('NCE_help_shown')
  
  if (savedLesson !== null) {
    currentLessonIdx.value = parseInt(savedLesson, 10)
  }
  if (savedWord !== null) {
    currentWordIdx.value = Math.min(parseInt(savedWord, 10), Math.max(data[currentLessonIdx.value]?.words.length - 1, 0))
  }
  if (savedAutoPlay !== null) {
    autoPlayEnabled.value = savedAutoPlay === 'true'
  }
  if (!savedHelpShown) {
    showHelpModal.value = true
  }

  await nextTick()
  isReadyForAutoPlay = true
})

// 监听进度变化并保存 LocalStorage
watch([currentLessonIdx, currentWordIdx], () => {
  localStorage.setItem('NCE_progress_lesson', currentLessonIdx.value)
  localStorage.setItem('NCE_progress_word', currentWordIdx.value)
  showMeaning.value = false // 切换时默认隐藏意思
})

watch(autoPlayEnabled, (enabled) => {
  localStorage.setItem('NCE_auto_play_enabled', enabled)
})

watch(showHelpModal, (visible) => {
  if (!visible) {
    localStorage.setItem('NCE_help_shown', 'true')
  }
})

// 切换单词时滚动词表，确保当前选中项在列表容器内可见（不影响页面滚动）
const wordListContainer = ref(null)
watch(currentWordIdx, async () => {
  await nextTick()
  const container = wordListContainer.value
  if (!container) return
  const activeEl = container.querySelector('.active-word')
  if (!activeEl) return

  const containerRect = container.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()

  // 元素在容器可视区域上方
  if (activeRect.top < containerRect.top) {
    container.scrollTop += activeRect.top - containerRect.top - 10
  }
  // 元素在容器可视区域下方
  else if (activeRect.bottom > containerRect.bottom) {
    container.scrollTop += activeRect.bottom - containerRect.bottom + 10
  }
})

watch([currentLessonIdx, currentWordIdx], async () => {
  if (!isReadyForAutoPlay || isDictating.value || !autoPlayEnabled.value) return

  await nextTick()
  const currentWordText = currentWordData.value?.word
  if (!currentWordText) return

  await playSpeech(currentWordText, true)
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
  if (autoPlayEnabled.value) return
  showMeaning.value = !showMeaning.value
}

const isMeaningVisible = computed(() => autoPlayEnabled.value || showMeaning.value)

const toggleAutoPlay = async () => {
  if (isDictating.value) return

  autoPlayEnabled.value = !autoPlayEnabled.value
  if (!autoPlayEnabled.value) return

  await nextTick()
  await playSpeech(currentWordData.value?.word, true)
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
    autoPlayEnabled.value = false
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
    
    <!-- 作者信息 -->
    <div class="author-info">
      <span class="author-text">✍️ by 瑾恒/瑾言爸爸</span>
    </div>

    <!-- 头部可爱统计板块 -->
    <header class="stats-grid">
      <div class="stat-box box-yellow">
        <!-- 玩法说明按钮 -->
        <button class="cute-btn help-btn" @click="showHelpModal = true" style="color: #000; font-size: 22px; padding: 5px 15px;">!</button>
        <span class="stat-icon">📖</span>
        <div class="stat-content">
          <span class="stat-label">当前教材</span>
          <span class="stat-value">新概念</span>
        </div>
      </div>
      <button class="cute-btn btn-danger dictation-btn" :class="{'btn-danger-active': isDictating}" @click="toggleDictation">
        {{ isDictating ? '⏹ 停止听写' : '▶️ 听写' }}
      </button>
      <div class="stat-box box-pink">
        <span class="stat-icon">📚</span>
        <div class="stat-content">
           <span class="stat-label">课程/词汇</span>
           <span class="stat-value">{{ totalCourses }}课/{{ totalWords }}词</span>
        </div>
      </div>
      <div class="stat-box box-green">
        <span class="stat-icon">🐱</span>
        <div class="stat-content">
           <span class="stat-label">本猫进度</span>
           <span class="stat-value">{{ progressStr }}</span>
        </div>
      </div>
    </header>

    <!-- 学习主舞台 -->
    <main class="learning-section">
      <div class="main-card card-shadow">
        <!-- 左侧/右侧隐形点击区 -->
        <div class="tap-zone tap-left" @click="prevWord"></div>
        <div class="tap-zone tap-right" @click="nextWord"></div>

        <div class="lesson-badge clickable-badge" @click="openModal">📂 第 {{ currentLessonData.lesson }} 关</div>
        <button class="auto-sound-badge"
                :class="{'auto-sound-badge-active': autoPlayEnabled}"
                @click="toggleAutoPlay">
          {{ autoPlayEnabled ? '🔊 关闭发音' : '🔊 自动发音' }}
        </button>
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
          <div class="meaning-box"
               @click="toggleMeaning"
               :class="{'revealed': isMeaningVisible, 'meaning-box-locked': autoPlayEnabled}">
            <span v-if="!isMeaningVisible" class="mystery-text">👆 点击这里，揭开中文秘密！</span>
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
      <div class="list-scroll-container" ref="wordListContainer">
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

    <!-- 玩法说明浮层 -->
    <div class="modal-overlay" v-if="showHelpModal" @click.self="showHelpModal = false">
      <div class="modal-content card-shadow help-modal">
        <div class="modal-header">
          <h3>💡 应用使用说明</h3>
          <button class="cute-btn btn-danger close-btn" @click="showHelpModal = false">✖</button>
        </div>
        <div class="modal-list help-content">
          
          <div class="help-item">
            <h4>👉 快速切换单词</h4>
            <div class="help-visual">
              <div class="demo-card">
                <div class="demo-tap-left">点击<br>上一个</div>
                <div class="demo-tap-right">点击<br>下一个</div>
                <div class="demo-word">单词卡片区</div>
              </div>
            </div>
            <p class="help-desc">在单词卡片的左侧/右侧隐形区域，可快速切换上一个/下一个单词。</p>
          </div>

          <div class="help-item">
            <div class="demo-btn-wrap">
              <span class="lesson-badge demo-static-badge" style="transform: rotate(-3deg) !important;">📂 第 X 关</span>
            </div>
            <p class="help-desc">想要挑战其他关卡？点击此标签即可打开关卡列表，自由选择你要学习的内容。</p>
          </div>

          <div class="help-item">
            <div class="demo-btn-wrap">
              <span class="auto-sound-badge demo-static-badge">🔊 自动发音</span>
            </div>
            <p class="help-desc">
              1. 切换单词后将<strong>自动朗读</strong>此单词。<br>
              2. 中文释义将<strong>直接展示</strong>，不再隐藏。
            </p>
          </div>

          <div class="help-item">
            <div class="demo-btn-wrap">
              <button class="cute-btn btn-danger demo-static-btn">▶️ 听写</button>
            </div>
            <p class="help-desc">
              每个单词会<strong>朗读3遍</strong>（每遍间隔2秒）。<br>
              随后中场休息<strong>5秒</strong>后进入下一个单词的循环，适合拿出纸笔一起听写。
            </p>
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
  padding: 25px 20px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  position: relative;
}

/* === 作者信息标签 === */
.author-info {
  position: absolute;
  top: 0;
  right: 30px;
  z-index: 10;
}
.author-text {
  display: inline-block;
  background-color: #fff;
  color: #3d405b;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1;
  font-weight: 900;
  border: 2px solid #3d405b;
  box-shadow: 1px 1px 0 #3d405b;
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
  position: relative;
  border: 4px solid #3d405b;
  border-radius: 16px;
  box-shadow: 0 4px 0 #3d405b;
  padding: 10px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.box-yellow { background-color: #FEE685; }
.box-pink { background-color: #FFD6A7; }
.box-blue { background-color: #A2F4FD; }
.box-green { background-color: #96F7E4; }

.stat-icon { font-size: 24px; }
.stat-content { display: flex; flex-direction: column; white-space: nowrap; }
.stat-label { font-size: 13px; color: #3d405b; font-weight: 900; }
.stat-value { font-size: 17px; font-weight: 900; color: #3B415A }


/* === 中间发音与学习区 === */
.learning-section {
  display: flex;
  flex-direction: column;
  gap: 28px;
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
.dictation-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
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
  margin-top: 15px;
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
  border-radius: 8px; z-index: 12; font-size: 18px;
}
.clickable-badge {
  cursor: pointer;
  transition: all 0.1s ease;
}
.clickable-badge:active {
  transform: rotate(-5deg) translateY(3px);
  box-shadow: 1px 1px 0 #3d405b;
}
.auto-sound-badge {
  position: absolute;
  top: -15px;
  right: -10px;
  background-color: #74b9ff;
  color: #fff;
  font-weight: 900;
  font-size: 18px;
  font-family: inherit;
  text-shadow: 1px 1px 0px #0984e3;
  padding: 5px 20px;
  transform: rotate(5deg);
  border: 4px solid #3d405b;
  box-shadow: -3px 3px 0 #3d405b;
  border-radius: 8px;
  z-index: 12;
  cursor: pointer;
  transition: all 0.1s ease;
}
.auto-sound-badge:active {
  transform: rotate(5deg) translateY(3px);
  box-shadow: -1px 1px 0 #3d405b;
}
.auto-sound-badge-active {
  background-color: #0984e3;
  text-shadow: 1px 1px 0px #0652a3;
}
.lesson-name {
  margin-top: 22px; font-size: 24px; color: #2d3436;
  text-decoration: underline; text-decoration-color: #a29bfe; text-decoration-thickness: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; padding: 0 10px;
}

.word-display {
  margin-top: 25px;
  position: relative;
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
  background-color: #A2F4FD; color: #00b894;
  padding: 6px 16px; border-radius: 12px; font-weight: 900;
  border: 3px solid #00b894; font-size: 14px;
  color: #005F89;
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
.meaning-box-locked {
  cursor: default;
}
.meaning-box-locked:active {
  transform: none;
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

/* === 帮助说明按钮与浮层 === */
.help-btn {
  position: absolute;
  top: -12px;
  left: -12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  z-index: 50;
  background-color: #74b9ff;
  color: #fff;
  box-shadow: 2px 2px 0 #3d405b;
  border-width: 3px;
}
.help-btn:active {
  transform: translateY(2px) !important;
  box-shadow: 0 0 0 #3d405b !important;
}

.help-modal { max-width: 500px; }
.help-content { 
  padding: 20px; 
  display: flex; 
  flex-direction: column; 
  gap: 15px; 
  text-align: left; 
  background: #fff;
  overflow-y: auto;
}
.help-item {
  border: 4px solid #dfe6e9;
  border-radius: 12px;
  padding: 15px;
  background-color: #f8fcfd;
}
.help-item h4 { 
  margin: 0 0 10px 0; 
  color: #3d405b; 
  font-size: 18px; 
}
.help-desc { 
  margin: 0; 
  color: #2d3436; 
  font-size: 15px; 
  line-height: 1.6; 
  font-weight: bold; 
}

.help-visual {
  margin-bottom: 10px;
}
.demo-card { 
  border: 4px solid #3d405b; 
  border-radius: 12px; 
  height: 80px; 
  display: flex; 
  position: relative; 
  background: #ffffff; 
  justify-content: center; 
  align-items: center;
  overflow: hidden;
}
.demo-tap-left, .demo-tap-right {
  position: absolute; 
  top: 0; 
  bottom: 0; 
  width: 30%; 
  background: rgba(255, 118, 117, 0.15); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  font-size: 13px; 
  font-weight: 900; 
  text-align: center; 
  color: #d63031;
}
.demo-tap-left { 
  left: 0; 
  border-right: 4px dashed #ff7675; 
}
.demo-tap-right { 
  right: 0; 
  border-left: 4px dashed #ff7675; 
}
.demo-word { 
  font-weight: 900; 
  color: #b2bec3; 
  font-size: 16px; 
}

.demo-btn-wrap {
  margin-bottom: 12px;
  margin-top: 5px;
  margin-left: 5px;
}
.demo-static-badge {
  position: relative !important;
  top: 0 !important;
  right: 0 !important;
  left: 0 !important;
  display: inline-block;
  pointer-events: none;
}
.demo-static-btn {
  display: inline-block !important;
  flex: none !important;
  width: auto !important;
  padding: 8px 25px !important;
  pointer-events: none;
  margin: 0;
}
</style>
