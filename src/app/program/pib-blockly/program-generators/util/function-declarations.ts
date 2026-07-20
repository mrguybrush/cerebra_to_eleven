import {CodeGenerator} from "blockly";

// play-audio-from-speech

export const PLAY_AUDIO_FROM_SPEECH_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(speech: str, voice: str) -> None:

    logging.info(f"received request to say '{speech}' as '{voice}'.")

    request = PlayAudioFromSpeech.Request()
    request.speech = speech
    request.join = True

    if voice == 'Hannah':
        request.gender = "Female"
        request.language = "German"
    elif voice == 'Daniel':
        request.gender = "Male"
        request.language = "German"
    elif voice == 'Emma':
        request.gender = "Female"
        request.language = "English"
    elif voice == 'Brian':
        request.gender = "Male"
        request.language = "English"
    else:
        logging.error(f"unrecognized voice: '{voice}', aborting...")
        return

    future = play_audio_from_speech_client.call_async(request)

    logging.info(f"now speaking...")
    __pib_spin_until_future_complete(future)
    logging.info("finished speaking.")
`;

// motor

export const GET_JOINT_POSITION_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(motor_name: str) -> int:

    request = GetJointPosition.Request()
    request.joint_name = motor_name

    future = get_joint_position_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response: GetJointPosition.Response = future.result()
    if response.successful:
        return response.position
    else:
        logging.error(f"getting position of '{motor_name}' failed.")
        return 0
`;

export const APPLY_JOINT_TRAJECTORY_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(motor_name: str, position: int) -> None:

    logging.info(f"setting position of '{motor_name}' to {position}.")

    request = ApplyJointTrajectory.Request()
    point = JointTrajectoryPoint()
    point.positions.append(position)
    jt = JointTrajectory()
    jt.joint_names = [motor_name]
    jt.points = [point]
    request.joint_trajectory = jt

    future = apply_joint_trajectory_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response: ApplyJointTrajectory.Response = future.result()
    if response.successful:
        logging.info(f"position of '{motor_name}' was successfully set.")
    else:
        logging.error(f"setting position of '{motor_name}' failed.")
`;

// movement speed

export const SET_MOVEMENT_SPEED_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(speed_percent: int) -> None:

    logging.info(f"setting global movement speed to {speed_percent}%.")

    request = ApplyMovementSettings.Request()
    request.movement_settings = MovementSettings(speed_percent=speed_percent)

    future = apply_movement_settings_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response: ApplyMovementSettings.Response = future.result()
    if response.settings_applied:
        logging.info(f"movement speed was successfully set.")
    else:
        logging.error(f"setting movement speed failed.")
`;

// pose

export const APPLY_POSE_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(poseId: str) -> None:

    logging.info(f"Pose ID: {poseId}")
    logging.info(f"moving to pose..")

    successful, motor_positions = pose_client.get_motor_positions_of_pose(
            poseId
        )
    if not successful:
        logging.error(f"getting motor-positions of pose failed.")
        return

    jt = JointTrajectory()
    jt.joint_names = []

    for motor_position in motor_positions["motorPositions"]:
        motor_name = motor_position["motorName"]
        position = motor_position["position"]

        jt.joint_names.append(motor_name)
        point = JointTrajectoryPoint()
        point.positions.append(position)
        jt.points.append(point)

    request = ApplyJointTrajectory.Request()
    request.joint_trajectory = jt

    future = apply_joint_trajectory_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response: ApplyJointTrajectory.Response = future.result()
    if response.successful:
        logging.info(f"pose was successfully applied.")
    else:
        logging.error(f"applying pose failed.")
`;

// gesture

export const APPLY_GESTURE_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(gestureId: str) -> None:

    logging.info(f"Gesture ID: {gestureId}")
    logging.info(f"applying gesture..")

    successful, motor_positions = gesture_client.get_motor_positions_of_gesture(
            gestureId
        )
    if not successful:
        logging.error(f"getting motor-positions of gesture failed.")
        return

    jt = JointTrajectory()
    jt.joint_names = []

    for motor_position in motor_positions["motorPositions"]:
        motor_name = motor_position["motorName"]
        position = motor_position["position"]

        jt.joint_names.append(motor_name)
        point = JointTrajectoryPoint()
        point.positions.append(position)
        jt.points.append(point)

    request = ApplyJointTrajectory.Request()
    request.joint_trajectory = jt

    future = apply_joint_trajectory_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response: ApplyJointTrajectory.Response = future.result()
    if response.successful:
        logging.info(f"gesture was successfully applied.")
    else:
        logging.error(f"applying gesture failed.")
`;

// movement-sequence

export const APPLY_MOVEMENT_SEQUENCE_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(sequenceId: str) -> None:

    logging.info(f"Movement Sequence ID: {sequenceId}")
    logging.info(f"playing back movement sequence..")

    successful, sequence = movement_sequence_client.get_frames_of_movement_sequence(
            sequenceId
        )
    if not successful:
        logging.error(f"getting frames of movement sequence failed.")
        return

    previous_timestamp_ms = 0
    for frame in sequence["frames"]:
        delay_s = (frame["timestampMs"] - previous_timestamp_ms) / 1000.0
        if delay_s > 0:
            time.sleep(delay_s)
        previous_timestamp_ms = frame["timestampMs"]

        jt = JointTrajectory()
        jt.joint_names = []
        point = JointTrajectoryPoint()
        for motor_name, position in frame["positions"].items():
            jt.joint_names.append(motor_name)
            point.positions.append(position)
        jt.points = [point]

        request = ApplyJointTrajectory.Request()
        request.joint_trajectory = jt

        future = apply_joint_trajectory_client.call_async(request)
        __pib_spin_until_future_complete(future)

    logging.info(f"movement sequence finished.")
`;

// set-solid-state-relay

export const SET_SOLID_STATE_RELAY_FUNCTION = (generator: CodeGenerator) => `

def ${generator.FUNCTION_NAME_PLACEHOLDER_}(status: str) -> None:

    state = status == 'ON'

    logging.info(f"received request to turn solid state relay to '{status}'.")
    request = SetSolidStateRelay.Request()
    request.solid_state_relay_state = SolidStateRelayState(turned_on=state)

    future = set_solid_state_relay_state_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response: SetSolidStateRelay.Response = future.result()
    if response.successful:
        logging.info(f"solid state relay was successfully set to '{status}'.")
    else:
        logging.error(f"setting solid state relay failed.")
`;

// get-solid-state-relay

export const GET_SOLID_STATE_RELAY_FUNCTION = (generator: CodeGenerator) => `

def ${generator.FUNCTION_NAME_PLACEHOLDER_}() -> bool:

    received = {}

    def _on_relay_state(msg):
        received["turned_on"] = msg.turned_on

    subscription = node.create_subscription(
        SolidStateRelayState, "solid_state_relay_state", _on_relay_state, 10
    )

    logging.info(f"waiting for solid state relay state...")
    while "turned_on" not in received:
        __pib_spin_once()
    node.destroy_subscription(subscription)

    logging.info(f"solid state relay is {'ON' if received['turned_on'] else 'OFF'}.")
    return received["turned_on"]
`;

// run-script

export const RUN_SCRIPT_FUNCTION = (generator: CodeGenerator) => `

def ${generator.FUNCTION_NAME_PLACEHOLDER_}(script: str, host: str, user: str, password: str, port: int) -> None:

    logging.info(f"connecting to {user}@{host}:{port} via ssh...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(hostname=host, port=port, username=user, password=password)

        logging.info(f"running script on {host}...")
        stdin, stdout, stderr = client.exec_command(script)
        exit_status = stdout.channel.recv_exit_status()

        out = stdout.read().decode()
        err = stderr.read().decode()

        if out:
            logging.info(out)
        if err:
            logging.error(err)

        logging.info(f"script finished with exit code {exit_status}.")
    except Exception as e:
        logging.error(f"ssh execution failed: {e}")
    finally:
        client.close()
`;

// face-detector

export const FACE_DETECTOR_CLASS = (generator: CodeGenerator) => `
class ${generator.FUNCTION_NAME_PLACEHOLDER_}():

    def __init__(self):
        self.NN_OMZ_NAME = "face-detection-retail-0004"
        self.labelMap = ["background", "face"]        
        self.NN_WIDTH = 300
        self.NN_HEIGHT = 300

        self.VIDEO_WIDTH = 1080                 
        self.VIDEO_HEIGHT = 720                 

        self.frame = None
        self.detections = []
        self.startTime = time.monotonic()
        self.counter = 0
        self.color1 = (255, 0, 0)
        self.color2 = (255, 255, 255)
        self.fps = 0

        self.xmin_big = 0
        self.ymin_big = 0
        self.xmax_big = 0
        self.ymax_big = 0
        self.x_center = 0
        self.y_center = 0

        self.init_pipeline()

    def init_pipeline(self):
        self.pipeline = dai.Pipeline()

        self.detection_nn = self.pipeline.create(dai.node.MobileNetDetectionNetwork)
        self.detection_nn.setBlobPath(blobconverter.from_zoo(name = self.NN_OMZ_NAME, shaves=6))
        self.detection_nn.setConfidenceThreshold(0.5)
        self.detection_nn.setNumInferenceThreads(2)
        self.detection_nn.setNumNCEPerInferenceThread(1)
        self.detection_nn.input.setBlocking(False)

        self.cam = self.pipeline.create(dai.node.ColorCamera)
        self.cam.setPreviewSize(self.NN_WIDTH, self.NN_HEIGHT)
        self.cam.setVideoSize(self.VIDEO_WIDTH, self.VIDEO_HEIGHT)
        self.cam.setPreviewKeepAspectRatio(False)
        self.cam.setInterleaved(False)						
        self.cam.setFps(120)						
        self.cam.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        self.cam.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
        self.cam.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)      
        self.cam.setIspScale(1, 1)
        self.cam.setVideoSize(self.VIDEO_WIDTH, self.VIDEO_HEIGHT)

        self.xout_cam = self.pipeline.create(dai.node.XLinkOut)
        self.xout_cam.setStreamName("cam")
        self.xout_nn = self.pipeline.create(dai.node.XLinkOut)
        self.xout_nn.setStreamName("nn")

        self.cam.video.link(self.xout_cam.input)
        self.cam.preview.link(self.detection_nn.input)
        self.detection_nn.out.link(self.xout_nn.input)

        self.device = dai.Device(self.pipeline)
        try:
            self.q_cam = self.device.getOutputQueue("cam", maxSize=1, blocking = False)
        except dai.XLinkError as exc:
            print(exc)

        try:
            self.q_nn = self.device.getOutputQueue("nn", maxSize=1, blocking = False)
        except dai.XLinkError as exc:
            print(exc)

    def frameNorm(self, bbox):
        normVals = np.full(len(bbox), self.frame.shape[0])
        normVals[::2] = self.frame.shape[1]
        return (np.clip(np.array(bbox), 0, 1) * normVals).astype(int)

    def displayFrame(self, name):
        self.xmin_big = 0
        self.ymin_big = 0
        self.xmax_big = 0
        self.ymax_big = 0

        for detection in self.detections:
            bbox = self.frameNorm((detection.xmin, detection.ymin, detection.xmax, detection.ymax))
            cv2.putText(self.frame, self.labelMap[detection.label], (bbox[0] +10, bbox[1] +20), cv2.FONT_HERSHEY_TRIPLEX, 0.5, self.color1)
            cv2.putText(self.frame, f"{int(detection.confidence * 100)}%", (bbox[0] +10, bbox[1] +40), cv2.FONT_HERSHEY_TRIPLEX, 0.5, self.color1)
            cv2.rectangle(self.frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), self.color1, 2)
            
            if ((detection.xmax - detection.xmin) * (detection.ymax - detection.ymin)) > ((self.xmax_big - self.xmin_big) * (self.ymax_big - self.ymin_big)):
                self.xmin_big = detection.xmin
                self.ymin_big = detection.ymin
                self.xmax_big = detection.xmax
                self.ymax_big = detection.ymax   

        cv2.imshow(name, self.frame)
        self.calculateMidpoint()

    def calculateMidpoint(self):
        if (self.xmin_big != 0 and self.ymin_big != 0 and self.xmax_big != 0 and self.ymax_big != 0):
            bbox = self.frameNorm((self.xmin_big, self.ymin_big, self.xmax_big, self.ymax_big))
            self.x_center = (bbox[0] + bbox[2])/2 - self.VIDEO_WIDTH/2
            self.y_center = (self.VIDEO_HEIGHT/2) - (bbox[1] + bbox[3])/2

    def updateDetector(self):
        self.in_frame = self.q_cam.tryGet()
        self.in_nn = self.q_nn.tryGet()

        if self.in_nn is not None:
            self.detections = self.in_nn.detections
            self.counter += 1

        if (time.monotonic() - self.startTime) > 1:
            self.fps = self.counter / (time.monotonic() - self.startTime)
            self.counter = 0
            self.startTime = time.monotonic()
            
        if self.in_frame is not None:
            self.frame = self.in_frame.getCvFrame()
            cv2.putText(self.frame, "NN FPS: {:.2f},".format(self.fps),
                (2, self.frame.shape[0] - 4), cv2.FONT_HERSHEY_TRIPLEX, 0.4, self.color2)  

        if self.frame is not None:
            self.displayFrame("Face Detector")
            
        return(self.x_center, self.y_center)
`;

export const SET_RGB_BUTTON_COLOR_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(button_number: int, colour_hex: str) -> None:
    hex_value = colour_hex.lstrip('#')
    r = int(hex_value[0:2], 16)
    g = int(hex_value[2:4], 16)
    b = int(hex_value[4:6], 16)

    request = SetRgbButtonColor.Request()
    request.bricklet_number = button_number
    request.r = r
    request.g = g
    request.b = b

    future = set_rgb_button_color_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response = future.result()
    if not (response and response.successful):
        logging.error(f"setting colour of button {button_number} failed.")
`;

export const GET_RGB_BUTTON_STATE_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(button_number: int) -> bool:

    request = GetRgbButtonState.Request()
    request.bricklet_number = button_number

    future = get_rgb_button_state_client.call_async(request)
    __pib_spin_until_future_complete(future)

    response = future.result()
    return bool(response and response.pressed)
`;

// set-eyes-emotion

export const SET_EYES_EMOTION_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(emotion: str) -> None:

    # "CUSTOM:<expressionId>" -> a user-created facial expression (see the
    # "Gesichtsausdruecke verwalten" page) - resolved via the show_custom_
    # facial_expression service, which fetches the gif from the pib-api and
    # displays it, rather than one of the fixed ImageId values below.
    if emotion.startswith("CUSTOM:"):
        expression_id = emotion[len("CUSTOM:"):]
        request = ShowCustomFacialExpression.Request()
        request.expression_id = expression_id
        future = show_custom_facial_expression_client.call_async(request)
        __pib_spin_until_future_complete(future)
        logging.info(f"custom facial expression '{expression_id}' shown.")
        return

    emotion_to_image_id = {
        'NEUTRAL': ImageId.PIB_EYES_ANIMATED,
        'HAPPY': ImageId.PIB_EYES_HAPPY,
        'SAD': ImageId.PIB_EYES_SAD,
        'ANGRY': ImageId.PIB_EYES_ANGRY,
        'SURPRISED': ImageId.PIB_EYES_SURPRISED,
        'SLEEPY': ImageId.PIB_EYES_SLEEPY,
        'HEART': ImageId.PIB_EYES_HEART,
        'STAR': ImageId.PIB_EYES_STAR,
        'COOL': ImageId.PIB_EYES_COOL,
        'WINK': ImageId.PIB_EYES_WINK,
    }

    image_id = emotion_to_image_id.get(emotion)
    if image_id is None:
        logging.error(f"unknown eye-emotion: '{emotion}'.")
        return

    message = DisplayImage()
    message.id = ImageId(value=image_id)
    display_image_publisher.publish(message)
    logging.info(f"eyes set to '{emotion}'.")
`;

// play-audio-from-file

export const PLAY_AUDIO_FROM_FILE_FUNCTION = (
    generator: CodeGenerator,
    voiceRecordingsDir: string,
) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(filename: str) -> None:

    filepath = "${voiceRecordingsDir}/" + filename
    logging.info(f"received request to play wav file '{filepath}'.")

    request = PlayAudioFromFile.Request()
    request.filepath = filepath
    request.join = True

    future = play_audio_from_file_client.call_async(request)
    __pib_spin_until_future_complete(future)
    logging.info("finished playing wav file.")
`;

// motor current

export const GET_MOTOR_CURRENT_FUNCTION = (generator: CodeGenerator) => `
def ${generator.FUNCTION_NAME_PLACEHOLDER_}(motor_name: str) -> int:

    received = {}

    def _on_current(msg):
        if msg.name == motor_name and msg.values:
            received["current"] = int(msg.values[0].value)

    subscription = node.create_subscription(
        DiagnosticStatus, "motor_current", _on_current, 10
    )

    logging.info(f"waiting for current reading of '{motor_name}'...")
    timeout_s = 5.0
    start = time.monotonic()
    while "current" not in received:
        __pib_spin_once(timeout_sec=0.1)
        if time.monotonic() - start > timeout_s:
            logging.error(
                f"timed out waiting for current of '{motor_name}' "
                f"(motor turned off or unknown name?)."
            )
            node.destroy_subscription(subscription)
            return 0

    node.destroy_subscription(subscription)
    return received["current"]
`;
