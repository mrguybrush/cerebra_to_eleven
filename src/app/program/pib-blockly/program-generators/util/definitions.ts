// imports

export const IMPORT_RCLPY = "import rclpy";
export const IMPORT_NUMPY = "import numpy as np";
export const IMPORT_CV2 = "import cv2";
export const IMPORT_DEPTHAI = "import depthai as dai";
export const IMPORT_BLOBCONVERTER = "import blobconverter";
export const IMPORT_SYS = "import sys";
export const IMPORT_TIME = "import time";
export const IMPORT_LOGGING = "import logging";
export const IMPORT_PLAY_AUDIO_FROM_SPREECH =
    "from datatypes.srv import PlayAudioFromSpeech";
export const IMPORT_APPLY_JOINT_TRAJECTORY =
    "from datatypes.srv import ApplyJointTrajectory";
export const IMPORT_GET_JOINT_POSITION =
    "from datatypes.srv import GetJointPosition";
export const IMPORT_APPLY_MOVEMENT_SETTINGS =
    "from datatypes.srv import ApplyMovementSettings";
export const IMPORT_MOVEMENT_SETTINGS_MESSAGE =
    "from datatypes.msg import MovementSettings";
export const IMPORT_JOINT_TRAJECTORY_MESSAGES =
    "from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint";
export const IMPORT_POSE_CLIENT = "from pib_api_client import pose_client";
export const IMPORT_GESTURE_CLIENT =
    "from pib_api_client import gesture_client";
export const IMPORT_MOVEMENT_SEQUENCE_CLIENT =
    "from pib_api_client import movement_sequence_client";
export const IMPORT_SET_SOLID_STATE_RELAY =
    "from datatypes.srv import SetSolidStateRelay";
export const IMPORT_SOLID_STATE_RELAY_STATE =
    "from datatypes.msg import SolidStateRelayState";
export const IMPORT_PARAMIKO = "import paramiko";

// ros

// rclpy.spin_until_future_complete()/spin_once() are NOT safe to call
// concurrently from multiple threads on the same node - two "wenn Programm
// startet" strands (see when-program-starts-generator.ts) each making a
// blocking ROS call at the same time crashes with "ValueError: generator
// already executing". Every generated helper spins the node through
// __pib_spin_until_future_complete()/__pib_spin_once() below instead of
// calling rclpy directly, serializing access via __pib_spin_lock.
export const INIT_ROS = `
import threading
rclpy.init()
node = rclpy.create_node("blockly_node")

__pib_spin_lock = threading.Lock()

def __pib_spin_until_future_complete(future):
    with __pib_spin_lock:
        rclpy.spin_until_future_complete(node, future)

def __pib_spin_once(timeout_sec=None):
    with __pib_spin_lock:
        if timeout_sec is None:
            rclpy.spin_once(node)
        else:
            rclpy.spin_once(node, timeout_sec=timeout_sec)
`;

// logging

export const CONFIGURE_LOGGING = `
# configure the python-logger
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.INFO)
stdout_handler.addFilter(lambda rec: rec.levelno <= logging.INFO)
stderr_handler = logging.StreamHandler()
stderr_handler.setLevel(logging.WARNING)
logging.basicConfig(
    level=logging.INFO,
    handlers=[stdout_handler, stderr_handler],
    format="[%(levelname)s] [%(asctime)s]: %(message)s",
    datefmt="%y-%m-%d %H:%M:%S", force=True
)
`;

// play-audio-from-speech

export const INIT_PLAY_AUDIO_FROM_SPEECH_CLIENT = `
play_audio_from_speech_client = node.create_client(
    PlayAudioFromSpeech, 
    'play_audio_from_speech'
)

logging.info(f"waiting for 'play_audio_from_speech' service to become available...")
play_audio_from_speech_client.wait_for_service()
logging.info(f"service now available")
`;

// motor

export const INIT_APPLY_JOINT_TRASJECTORY_CLIENT = `
apply_joint_trajectory_client = node.create_client(
    ApplyJointTrajectory,
    'apply_joint_trajectory'
)

logging.info(f"waiting for 'apply_joint_trajectory' service to become available...")
apply_joint_trajectory_client.wait_for_service()
logging.info(f"service now available")
`;

export const INIT_GET_JOINT_POSITION_CLIENT = `
get_joint_position_client = node.create_client(
    GetJointPosition,
    'get_joint_position'
)

logging.info(f"waiting for 'get_joint_position' service to become available...")
get_joint_position_client.wait_for_service()
logging.info(f"service now available")
`;

export const INIT_APPLY_MOVEMENT_SETTINGS_CLIENT = `
apply_movement_settings_client = node.create_client(
    ApplyMovementSettings,
    'apply_movement_settings'
)

logging.info(f"waiting for 'apply_movement_settings' service to become available...")
apply_movement_settings_client.wait_for_service()
logging.info(f"service now available")
`;

// set solid state relay

export const INIT_SET_SOLID_STATE_RELAY_STATE_CLIENT = `
set_solid_state_relay_state_client = node.create_client(
    SetSolidStateRelay,
    'set_solid_state_relay_state'
)

logging.info(f"waiting for 'set_solid_state_relay_state' service to become available...")
set_solid_state_relay_state_client.wait_for_service()
logging.info(f"service now available")
`;

export const IMPORT_SET_RGB_BUTTON_COLOR =
    "from datatypes.srv import SetRgbButtonColor";
export const IMPORT_GET_RGB_BUTTON_STATE =
    "from datatypes.srv import GetRgbButtonState";

export const INIT_SET_RGB_BUTTON_COLOR_CLIENT = `
set_rgb_button_color_client = node.create_client(
    SetRgbButtonColor,
    'set_rgb_button_color'
)

logging.info(f"waiting for 'set_rgb_button_color' service to become available...")
set_rgb_button_color_client.wait_for_service()
logging.info(f"service now available")
`;

export const INIT_GET_RGB_BUTTON_STATE_CLIENT = `
get_rgb_button_state_client = node.create_client(
    GetRgbButtonState,
    'get_rgb_button_state'
)

logging.info(f"waiting for 'get_rgb_button_state' service to become available...")
get_rgb_button_state_client.wait_for_service()
logging.info(f"service now available")
`;

// display (eyes on pib's screen)

export const IMPORT_DISPLAY_IMAGE_MESSAGES =
    "from datatypes.msg import DisplayImage, ImageId";

export const INIT_DISPLAY_IMAGE_PUBLISHER = `
display_image_publisher = node.create_publisher(DisplayImage, 'display_image', 1)

# wait until the display-node has discovered this publisher, so that the
# first published image does not get lost
for _ in range(50):
    if display_image_publisher.get_subscription_count() > 0:
        break
    time.sleep(0.1)
else:
    logging.warning("display-node does not seem to be listening...")
`;

// play-audio-from-file (play_wav block)

export const IMPORT_PLAY_AUDIO_FROM_FILE =
    "from datatypes.srv import PlayAudioFromFile";

// same directory mounted into flask-app (upload/list/delete) and
// ros-voice-assistant (actual playback) - see docker-compose.yaml's
// VOICE_RECORDINGS_DIR env var on both services.
export const VOICE_RECORDINGS_DIR = "/data/voice_recordings";

export const INIT_PLAY_AUDIO_FROM_FILE_CLIENT = `
play_audio_from_file_client = node.create_client(
    PlayAudioFromFile,
    'play_audio_from_file'
)

logging.info(f"waiting for 'play_audio_from_file' service to become available...")
play_audio_from_file_client.wait_for_service()
logging.info(f"service now available")
`;

// show-custom-facial-expression (set_eyes_emotion block, custom expressions)

export const IMPORT_SHOW_CUSTOM_FACIAL_EXPRESSION =
    "from datatypes.srv import ShowCustomFacialExpression";

export const INIT_SHOW_CUSTOM_FACIAL_EXPRESSION_CLIENT = `
show_custom_facial_expression_client = node.create_client(
    ShowCustomFacialExpression,
    'show_custom_facial_expression'
)

logging.info(f"waiting for 'show_custom_facial_expression' service to become available...")
show_custom_facial_expression_client.wait_for_service()
logging.info(f"service now available")
`;

// motor current

export const IMPORT_DIAGNOSTIC_STATUS_MESSAGE =
    "from diagnostic_msgs.msg import DiagnosticStatus";
