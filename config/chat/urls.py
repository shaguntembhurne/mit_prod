from django.urls import path

from .views import ChatAPIView

app_name = "chat"

urlpatterns = [
    path("", ChatAPIView.as_view(), name="chat"),
]
