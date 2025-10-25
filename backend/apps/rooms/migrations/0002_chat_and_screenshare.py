# Generated migration for chat and screen share models

from django.db import migrations, models
import django.db.models.deletion
import uuid
import apps.rooms.chat_models


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('message_type', models.CharField(choices=[('text', 'Text Message'), ('file', 'File Attachment'), ('system', 'System Message')], default='text', max_length=20)),
                ('content', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('edited_at', models.DateTimeField(blank=True, null=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('participant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='messages', to='rooms.roomparticipant')),
                ('reply_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replies', to='rooms.chatmessage')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_messages', to='rooms.room')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='ChatAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to=apps.rooms.chat_models.chat_file_upload_path)),
                ('original_filename', models.CharField(max_length=255)),
                ('file_type', models.CharField(choices=[('image', 'Image'), ('document', 'Document'), ('archive', 'Archive'), ('other', 'Other')], default='other', max_length=20)),
                ('file_size', models.BigIntegerField()),
                ('mime_type', models.CharField(max_length=100)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('download_count', models.IntegerField(default=0)),
                ('message', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='rooms.chatmessage')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_attachments', to='rooms.room')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_files', to='rooms.roomparticipant')),
            ],
            options={
                'ordering': ['uploaded_at'],
            },
        ),
        migrations.CreateModel(
            name='ScreenShareSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('active', 'Active'), ('paused', 'Paused'), ('stopped', 'Stopped')], default='active', max_length=20)),
                ('stream_id', models.CharField(max_length=255)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('stopped_at', models.DateTimeField(blank=True, null=True)),
                ('total_duration', models.IntegerField(default=0)),
                ('viewer_count', models.IntegerField(default=0)),
                ('participant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='screen_shares', to='rooms.roomparticipant')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='screen_shares', to='rooms.room')),
            ],
            options={
                'ordering': ['-started_at'],
            },
        ),
        migrations.AddIndex(
            model_name='chatmessage',
            index=models.Index(fields=['room', 'created_at'], name='rooms_chatm_room_id_b8e4a5_idx'),
        ),
        migrations.AddIndex(
            model_name='chatmessage',
            index=models.Index(fields=['participant', 'created_at'], name='rooms_chatm_partici_c7f9d2_idx'),
        ),
        migrations.AddIndex(
            model_name='chatattachment',
            index=models.Index(fields=['room', 'uploaded_at'], name='rooms_chata_room_id_a3d8f1_idx'),
        ),
        migrations.AddIndex(
            model_name='chatattachment',
            index=models.Index(fields=['message'], name='rooms_chata_message_e9b2c4_idx'),
        ),
        migrations.AddIndex(
            model_name='screensharesession',
            index=models.Index(fields=['room', 'status'], name='rooms_scree_room_id_d5a7b3_idx'),
        ),
        migrations.AddIndex(
            model_name='screensharesession',
            index=models.Index(fields=['participant', 'status'], name='rooms_scree_partici_f2c8e6_idx'),
        ),
    ]
