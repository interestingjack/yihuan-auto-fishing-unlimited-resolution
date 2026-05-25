import sys
import os
import ctypes

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

if not is_admin():
    ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join([f'"{arg}"' for arg in sys.argv]), None, 1)
    sys.exit(0)

import json
import numpy as np
import win32gui
import win32con
from windows_capture import WindowsCapture, Frame, InternalCaptureControl

VK_A = 0x41
VK_D = 0x44
WM_ACTIVATE = win32con.WM_ACTIVATE
WA_ACTIVE = 1
TOLERANCE = 5

def 窗口假激活(hwnd):
    win32gui.SendMessage(hwnd, WM_ACTIVATE, WA_ACTIVE, 0)

def key_down(hwnd, vk):
    win32gui.PostMessage(hwnd, win32con.WM_KEYDOWN, vk, 0)

def key_up(hwnd, vk):
    win32gui.PostMessage(hwnd, win32con.WM_KEYUP, vk, 0)

def find_game_window():
    candidates = []
    def callback(hwnd, _):
        title = win32gui.GetWindowText(hwnd)
        cls = win32gui.GetClassName(hwnd)
        rect = win32gui.GetClientRect(hwnd)
        w, h = rect[2], rect[3]
        if w > 100 and h > 100:
            if "UnrealWindow" in cls:
                print(f"  候选: hwnd={hwnd} 类名={cls} 标题=[{title}] 大小={w}x{h}")
                candidates.append((hwnd, w * h))
        return True
    win32gui.EnumWindows(callback, None)
    if candidates:
        candidates.sort(key=lambda x: -x[1])
        return candidates[0][0]
    return None

def load_colors(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # 排除接近黑色的颜色
    return np.array([item["rgb"] for item in data if sum(item["rgb"]) > 100], dtype=np.int16)

def match_mask(img_rgb, colors):
    """用numpy广播匹配多个颜色，返回bool mask"""
    # img_rgb: (H, W, 3), colors: (N, 3)
    # 逐颜色检查，用numpy向量化每个颜色的匹配
    img = img_rgb.astype(np.int16)
    mask = np.zeros(img.shape[:2], dtype=bool)
    for c in colors:
        m = np.all(np.abs(img - c) <= TOLERANCE, axis=2)
        mask |= m
    return mask

def find_bar(img_rgb, zone_colors, cursor_colors):
    """找到钓鱼条位置"""
    # 第一步：用精确阈值快速找候选行（绿区: R=30-55, G=180-230, B=170-200）
    rough_mask = (img_rgb[:,:,0] > 25) & (img_rgb[:,:,0] < 60) & \
                 (img_rgb[:,:,1] > 180) & (img_rgb[:,:,1] < 235) & \
                 (img_rgb[:,:,2] > 165) & (img_rgb[:,:,2] < 205)

    # 找绿色像素跨度<=250的行
    row_has = rough_mask.any(axis=1)
    candidate_row = -1
    best_count = 0
    for r in np.where(row_has)[0]:
        xs = np.where(rough_mask[r])[0]
        if len(xs) < 5:
            continue
        span = int(xs[-1] - xs[0])
        if span <= 250 and len(xs) > best_count:
            best_count = len(xs)
            candidate_row = r

    if candidate_row < 0:
        return None

    # 第二步：只在候选行±10（共20像素）内用JSON颜色精确匹配
    r0 = max(0, candidate_row - 10)
    r1 = min(img_rgb.shape[0], candidate_row + 10)
    band = img_rgb[r0:r1]

    # 精确匹配绿区
    zone_mask = match_mask(band, zone_colors)
    g_xs = np.where(zone_mask.any(axis=0))[0]
    if len(g_xs) < 5:
        return None
    zone_min = int(g_xs.min())
    zone_max = int(g_xs.max())
    if zone_max - zone_min > 250:
        return None

    # 精确匹配光标
    cursor_mask = match_mask(band, cursor_colors)
    y_cols = cursor_mask.sum(axis=0)
    if y_cols.max() < 2:
        return None
    cursor_x = int(np.argmax(y_cols))

    zone_center = (zone_min + zone_max) // 2
    return cursor_x, zone_min, zone_max, zone_center

if __name__ == "__main__":
  try:
    script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    zone_colors = load_colors(os.path.join(script_dir, "鱼的框_colors.json"))
    cursor_colors = load_colors(os.path.join(script_dir, "钓鱼的框_colors.json"))
    print(f"加载颜色: 绿区{len(zone_colors)}种, 光标{len(cursor_colors)}种")

    hwnd = find_game_window()
    if not hwnd:
        print("未找到异环窗口")
        input("按回车键退出...")
        sys.exit(1)

    print(f"找到窗口: {hwnd} [{win32gui.GetWindowText(hwnd)}]")
    # 确保窗口不是最小化状态
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        import time
        time.sleep(0.5)
    print("开始运行... (Ctrl+C 退出)")
    窗口假激活(hwnd)

    current_key = [None]
    frame_count = [0]

    capture = WindowsCapture(cursor_capture=False, draw_border=False, window_hwnd=hwnd)

    @capture.event
    def on_frame_arrived(frame: Frame, capture_control: InternalCaptureControl):
        try:
            frame_count[0] += 1
            img = frame.frame_buffer
            h = img.shape[0]
            top = img[:h // 4, :, 2::-1]

            result = find_bar(top, zone_colors, cursor_colors)

            if result is None:
                if frame_count[0] % 60 == 0:
                    print(f"帧{frame_count[0]}: 未检测到钓鱼条")
                if current_key[0]:
                    key_up(hwnd, current_key[0])
                    current_key[0] = None
                return

            cursor_x, zone_min, zone_max, zone_center = result

            if frame_count[0] % 60 == 0:
                print(f"光标:{cursor_x} 绿区:{zone_min}-{zone_max}(中{zone_center})")

            if cursor_x < zone_center - 10:
                if current_key[0] == VK_A:
                    key_up(hwnd, VK_A)
                if current_key[0] != VK_D:
                    key_down(hwnd, VK_D)
                    current_key[0] = VK_D
            elif cursor_x > zone_center + 10:
                if current_key[0] == VK_D:
                    key_up(hwnd, VK_D)
                if current_key[0] != VK_A:
                    key_down(hwnd, VK_A)
                    current_key[0] = VK_A
            else:
                if current_key[0]:
                    key_up(hwnd, current_key[0])
                    current_key[0] = None
        except Exception as e:
            print(f"回调错误: {e}")

    @capture.event
    def on_closed():
        pass

    try:
        capture.start()
    except KeyboardInterrupt:
        pass
    finally:
        if current_key[0]:
            key_up(hwnd, current_key[0])
    print("已停止")
  except Exception as e:
    import traceback
    traceback.print_exc()
    input("按回车键退出...")
