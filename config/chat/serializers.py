from rest_framework import serializers


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=("user", "assistant"))
    content = serializers.CharField(max_length=12000, allow_blank=False, trim_whitespace=True)


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=12000, allow_blank=False, trim_whitespace=True)
    history = ChatMessageSerializer(many=True, required=False, allow_empty=True)

    def validate_history(self, value):
        if len(value) > 20:
            raise serializers.ValidationError("History may contain at most 20 messages.")
        return value
