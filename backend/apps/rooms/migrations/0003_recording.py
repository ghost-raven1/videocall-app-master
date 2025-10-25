# Generated migration for Recording model

from django.db import migrations, models
import django.db.models.deletion
import uuid
import apps.rooms.recording_models


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0002_chat_and_screenshare'),
    ]

    operations = [
        migrations.CreateModel(
            name='Recording',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('stopped_at', models.DateTimeField(blank=True, null=True)),
                ('file', models.FileField(blank=True, null=True, upload_to=apps.rooms.recording_models.recording_upload_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['webm', 'mp4', 'mkv'])])),
                ('file_size', models.BigIntegerField(default=0)),
                ('duration', models.IntegerField(default=0)),
                ('status', models.CharField(choices=[('recording', 'Recording'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='recording', max_length=20)),
                ('error_message', models.TextField(blank=True)),
                ('include_audio', models.BooleanField(default=True)),
                ('include_video', models.BooleanField(default=True)),
                ('include_screen_share', models.BooleanField(default=True)),
                ('is_public', models.BooleanField(default=False)),
                ('password', models.CharField(blank=True, max_length=255)),
                ('view_count', models.IntegerField(default=0)),
                ('download_count', models.IntegerField(default=0)),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recordings', to='rooms.room')),
                ('started_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='started_recordings', to='rooms.roomparticipant')),
            ],
            options={
                'ordering': ['-started_at'],
            },
        ),
        migrations.AddIndex(
            model_name='recording',
            index=models.Index(fields=['room', 'started_at'], name='rooms_recor_room_id_idx'),
        ),
        migrations.AddIndex(
            model_name='recording',
            index=models.Index(fields=['status'], name='rooms_recor_status_idx'),
        ),
    ]
