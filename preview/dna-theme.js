import '../miniprogram/config/dna-theme.js';
import '../miniprogram/utils/dna-renderer.js';

const renderer = globalThis.QingchuangDnaRenderer(globalThis.QingchuangDnaTheme);
export const { theme, buildDna, drawFallbackDna, stageForNode, describeNode, rungColor } = renderer;
