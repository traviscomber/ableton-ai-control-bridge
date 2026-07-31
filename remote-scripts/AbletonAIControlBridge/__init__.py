from .control_surface import AbletonAIControlBridge


def create_instance(c_instance):
    return AbletonAIControlBridge(c_instance)
