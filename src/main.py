import threading
import signal
import time
import websocket

# websocket.enableTrace(True)

# 标志变量，用于指示是否应该继续创建新线程
create_new_threads = True

# 线程列表，用于跟踪所有启动的线程
threads = []


def on_message(ws, message):
    if create_new_threads:
        thread = threading.Thread(target=handle_message, args=(message,))
        threads.append(thread)
        thread.start()
    else:
        print(f"Received message but not creating new thread: {message}")


def handle_message(message):
    # 模拟处理消息的工作
    print(f"Handling message: {message}")
    time.sleep(5)  # 模拟耗时任务
    print(f"Finished handling message: {message}")


def on_error(ws, error):
    print(f"Error: {error}")


def on_close(ws, close_status_code, close_msg):
    print("### closed ###")


def on_open(ws):
    print("### opened ###")


def signal_handler(sig, frame):
    global create_new_threads
    print("Ctrl-C pressed. Stopping the creation of new threads.")
    create_new_threads = False


# 设置信号处理器
signal.signal(signal.SIGINT, signal_handler)

# 创建 WebSocket 应用
ws = websocket.WebSocketApp("ws://echo.websocket.events/",
                            origin="testing_websockets.com",
                            on_open=on_open,
                            on_message=on_message,
                            on_error=on_error,
                            on_close=on_close)

# 在单独的线程中运行 WebSocket 应用
ws_thread = threading.Thread(target=ws.run_forever)
ws_thread.start()

# 等待 WebSocket 线程完成
ws_thread.join()

# 等待所有消息处理线程完成
for thread in threads:
    thread.join()

print("All threads have been completed. Exiting.")
