# apps/rooms/sfu_client.py - Django client for Go SFU server communication
import json
import logging
from django.conf import settings
import requests
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class SFUClient:
    """Client for communicating with Go SFU server"""

    def __init__(self):
        self.base_url = getattr(settings, 'SFU_API_BASE_URL', 'http://localhost:8080/api')
        self.ws_base_url = getattr(settings, 'SFU_WS_BASE_URL', 'ws://localhost:8080/ws')
        self.timeout = 10

    def _make_request(self, method, endpoint, data=None, params=None, max_retries=3):
        """Make HTTP request to SFU server with retry logic"""
        url = urljoin(self.base_url, endpoint)
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Django-VideoCall/1.0'
        }

        for attempt in range(max_retries):
            try:
                response = requests.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=data,
                    params=params,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()

            except requests.exceptions.Timeout:
                if attempt == max_retries - 1:
                    logger.error(f"SFU API timeout after {max_retries} attempts: {url}")
                    return {'success': False, 'error': 'SFU server timeout'}
                logger.warning(f"SFU API timeout, retrying ({attempt + 1}/{max_retries})")
                continue

            except requests.exceptions.ConnectionError:
                if attempt == max_retries - 1:
                    logger.error(f"SFU API connection error after {max_retries} attempts: {url}")
                    return {'success': False, 'error': 'SFU server unavailable'}
                logger.warning(f"SFU API connection error, retrying ({attempt + 1}/{max_retries})")
                continue

            except requests.exceptions.HTTPError as e:
                if response.status_code >= 500:
                    if attempt == max_retries - 1:
                        logger.error(f"SFU API server error ({response.status_code}) after {max_retries} attempts")
                        return {'success': False, 'error': f'SFU server error: {response.status_code}'}
                    logger.warning(f"SFU API server error ({response.status_code}), retrying ({attempt + 1}/{max_retries})")
                    continue
                else:
                    # Client errors (4xx) don't retry
                    logger.error(f"SFU API client error ({response.status_code}): {e}")
                    return {'success': False, 'error': f'SFU API error: {response.status_code}'}

            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    logger.error(f"SFU API request failed after {max_retries} attempts: {e}")
                    return {'success': False, 'error': str(e)}
                logger.warning(f"SFU API request error, retrying ({attempt + 1}/{max_retries}): {e}")
                continue

            except json.JSONDecodeError as e:
                logger.error(f"SFU API response decode failed: {e}")
                return {'success': False, 'error': 'Invalid response format'}

        # Should not reach here, but just in case
        return {'success': False, 'error': 'Max retries exceeded'}

    def create_room(self, room_id):
        """Create a new SFU room"""
        endpoint = 'rooms'
        data = {
            'room_id': room_id,
            'max_participants': getattr(settings, 'MAX_PARTICIPANTS_PER_ROOM', 15)
        }

        response = self._make_request('POST', endpoint, data=data)

        if response.get('success'):
            return {
                'success': True,
                'room_id': response.get('room_id'),
                'ws_url': response.get('ws_url'),
                'created_at': response.get('created_at')
            }

        return response

    def get_room(self, sfu_room_id):
        """Get SFU room information"""
        endpoint = f'rooms/{sfu_room_id}'
        return self._make_request('GET', endpoint)

    def delete_room(self, sfu_room_id):
        """Delete SFU room"""
        endpoint = f'rooms/{sfu_room_id}'
        return self._make_request('DELETE', endpoint)

    def add_participant(self, sfu_room_id, participant_id, metadata=None):
        """Add participant to SFU room"""
        endpoint = f'rooms/{sfu_room_id}/participants'
        data = {
            'participant_id': participant_id,
            'metadata': metadata or {}
        }

        return self._make_request('POST', endpoint, data=data)

    def remove_participant(self, sfu_room_id, participant_id):
        """Remove participant from SFU room"""
        endpoint = f'rooms/{sfu_room_id}/participants/{participant_id}'
        return self._make_request('DELETE', endpoint)

    def get_room_stats(self, sfu_room_id):
        """Get SFU room statistics"""
        endpoint = f'rooms/{sfu_room_id}/stats'
        return self._make_request('GET', endpoint)

    def health_check(self):
        """Check SFU server health"""
        endpoint = 'health'
        return self._make_request('GET', endpoint)

    def get_server_stats(self):
        """Get SFU server statistics"""
        endpoint = 'stats'
        return self._make_request('GET', endpoint)