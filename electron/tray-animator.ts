import { Tray, nativeImage } from 'electron';

let animationInterval: NodeJS.Timeout | null = null;
let currentFrame = 0;
let trayRef: Tray | null = null;
let idleIconPath = '';
let activeIconPath = '';

export function startPulsing(tray: Tray, idlePath: string, activePath: string) {
    if (animationInterval) return;

    trayRef = tray;
    idleIconPath = idlePath;
    activeIconPath = activePath;

    // Toggle every 800ms for a subtle pulse
    animationInterval = setInterval(() => {
        const iconPath = currentFrame === 0 ? activeIconPath : idleIconPath;
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
            trayRef?.setImage(icon.resize({ width: 16, height: 16 }));
        }
        currentFrame = (currentFrame + 1) % 2;
    }, 800);
}

export function stopPulsing(tray: Tray, idlePath: string) {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }

    const icon = nativeImage.createFromPath(idlePath);
    if (!icon.isEmpty()) {
        tray.setImage(icon.resize({ width: 16, height: 16 }));
    }
}
