import { useEffect, useState } from 'react'
import { SakurunWidget } from './sakurun'
import { MagiApp } from './magi/MagiApp'

// #magi は幹部専用の裏ページ（MAGI意思決定支援）。それ以外はさくるん本体。
function App() {
  const [hash, setHash] = useState(() => location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isMagi = hash === '#magi'

  // MAGIはダークテーマのためbodyの配色をページ単位で切り替える
  useEffect(() => {
    document.body.classList.toggle('magi-mode', isMagi)
  }, [isMagi])

  if (isMagi) return <MagiApp />

  return (
    <>
      <SakurunWidget />
      {/* 隠しモード：右下のフローティングボタンからMAGI（幹部専用）へ */}
      <a className="magi-fab" href="#magi" title="MAGI意思決定支援（幹部専用）" aria-label="MAGI意思決定支援を開く">
        ⚙
      </a>
    </>
  )
}

export default App
