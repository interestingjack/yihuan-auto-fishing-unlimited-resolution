// Scene registry: id -> { draw(g, localTime, scene), trans, transDur, tag, noHud, grain, vignette, init }
import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';
import ch5 from './ch5.js';
import ch6 from './ch6.js';
import ch7 from './ch7.js';

export const SCENES = { ...ch1, ...ch2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7 };
