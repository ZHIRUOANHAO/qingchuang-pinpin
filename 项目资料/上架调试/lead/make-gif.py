from PIL import Image
import glob, os
base = r'D:\UserFolders\Desktop\qingchuang-pinpin\项目资料\上架调试\lead'
frames_dir = os.path.join(base, 'flight-frames')
files = sorted(glob.glob(os.path.join(frames_dir, 'frame-*.png')))
selected = files[::2][:24]
images = []
for f in selected:
    im = Image.open(f).convert('RGB')
    ratio = 440 / im.width
    images.append(im.resize((440, int(im.height * ratio)), Image.LANCZOS))
gif_path = os.path.join(base, 'home-flight.gif')
images[0].save(gif_path, save_all=True, append_images=images[1:], duration=160, loop=0, optimize=True)
print('gif', round(os.path.getsize(gif_path)/1024), 'KB', Image.open(gif_path).size, len(images), 'frames')
