/**
 * V槽 CMS — 主题定义（前台 / 后台共用）
 * 每套主题 = 一组 CSS 变量 + 字体。想加新主题，复制一套改 key、颜色、字体即可。
 * 应用方式：applyTheme(key) 会把 vars 写到 :root，并按需注入 Google Fonts。
 */
(function (global) {
  const THEMES = {
    green: {
      name: '品牌·翠绿',
      desc: '清爽绿意、专业稳重（默认，贴合当前站点）',
      fonts: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
      vars: {
        '--primary': '#23AC38',
        '--primary-dark': '#1a8c2d',
        '--primary-light': '#e8f5e9',
        '--accent': '#E60012',
        '--accent-dark': '#b80010',
        '--dark': '#1a2e1a',
        '--hero-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(35,172,56,0.25) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 80% 70%,rgba(230,0,18,0.08) 0%,transparent 60%),linear-gradient(160deg,#1a2e1a 0%,#1a5a2e 50%,#1a2e1a 100%)',
        '--radius-sm': '8px',
        '--radius-md': '12px',
        '--radius-lg': '20px',
        '--font-display': "'Bebas Neue',sans-serif",
        '--font-body': "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      },
    },
    industrial: {
      name: '工业·橙黑',
      desc: '深色硬朗、力量感，适合机械 / 制造业',
      fonts: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
      vars: {
        '--primary': '#ff6a00',
        '--primary-dark': '#d95700',
        '--primary-light': '#fff1e6',
        '--accent': '#ffd60a',
        '--accent-dark': '#e0b800',
        '--dark': '#141414',
        '--hero-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(255,106,0,0.28) 0%,transparent 70%),linear-gradient(160deg,#0d0d0d 0%,#2a1a0d 50%,#0d0d0d 100%)',
        '--radius-sm': '4px',
        '--radius-md': '6px',
        '--radius-lg': '10px',
        '--font-display': "'Oswald',sans-serif",
        '--font-body': "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      },
    },
    tech: {
      name: '科技·深蓝',
      desc: '深蓝霓虹、玻璃质感，适合智能 / 数控 / 高端设备',
      fonts: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
      vars: {
        '--primary': '#2f6bff',
        '--primary-dark': '#1e4fd6',
        '--primary-light': '#e8f0ff',
        '--accent': '#00e5ff',
        '--accent-dark': '#00b8cc',
        '--dark': '#0a1024',
        '--hero-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(47,107,255,0.3) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 80% 70%,rgba(0,229,255,0.12) 0%,transparent 60%),linear-gradient(160deg,#070b1a 0%,#0f1e4a 50%,#070b1a 100%)',
        '--radius-sm': '8px',
        '--radius-md': '14px',
        '--radius-lg': '22px',
        '--font-display': "'Rajdhani',sans-serif",
        '--font-body': "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      },
    },
    minimal: {
      name: '极简·留白',
      desc: '黑白克制、杂志编排，适合精品工作室 / 高端定位',
      fonts: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
      vars: {
        '--primary': '#111111',
        '--primary-dark': '#000000',
        '--primary-light': '#f2f2f2',
        '--accent': '#c8a24a',
        '--accent-dark': '#a8842f',
        '--dark': '#1c1c1c',
        '--hero-gradient':
          'linear-gradient(160deg,#1c1c1c 0%,#333 55%,#1c1c1c 100%)',
        '--radius-sm': '2px',
        '--radius-md': '4px',
        '--radius-lg': '6px',
        '--font-display': "'Playfair Display',serif",
        '--font-body': "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      },
    },
    elegant: {
      name: '优雅·墨绿',
      desc: '米色衬线、沉稳高级，适合传统出口 / 品牌叙事',
      fonts: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
      vars: {
        '--primary': '#1f5c4d',
        '--primary-dark': '#153f35',
        '--primary-light': '#e7f0ec',
        '--accent': '#b08d57',
        '--accent-dark': '#8f6f3f',
        '--dark': '#12261f',
        '--hero-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(31,92,77,0.35) 0%,transparent 70%),linear-gradient(160deg,#0f1f19 0%,#1f4a3d 55%,#0f1f19 100%)',
        '--radius-sm': '6px',
        '--radius-md': '10px',
        '--radius-lg': '16px',
        '--font-display': "'Noto Serif SC',serif",
        '--font-body': "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      },
    },
    vibrant: {
      name: '活力·热橙',
      desc: '明快圆润、有冲击力，适合电商 / 快消导向',
      fonts: 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
      vars: {
        '--primary': '#ff5722',
        '--primary-dark': '#e04412',
        '--primary-light': '#fff0eb',
        '--accent': '#ffb300',
        '--accent-dark': '#e09b00',
        '--dark': '#2a1710',
        '--hero-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(255,87,34,0.3) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 80% 70%,rgba(255,179,0,0.15) 0%,transparent 60%),linear-gradient(160deg,#2a1710 0%,#7a3418 50%,#2a1710 100%)',
        '--radius-sm': '12px',
        '--radius-md': '18px',
        '--radius-lg': '28px',
        '--font-display': "'Baloo 2',cursive",
        '--font-body': "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      },
    },
  };

  const injectedFonts = new Set();

  function applyTheme(key) {
    const theme = THEMES[key] || THEMES.green;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    if (theme.fonts && !injectedFonts.has(theme.fonts)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = theme.fonts;
      document.head.appendChild(link);
      injectedFonts.add(theme.fonts);
    }
    return theme;
  }

  global.VG_THEMES = THEMES;
  global.applyTheme = applyTheme;
})(typeof window !== 'undefined' ? window : this);
