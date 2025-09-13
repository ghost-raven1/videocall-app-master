#!/usr/bin/env python3
"""
Скрипт для обеспечения наличия статических файлов Django
Запускается при старте backend сервиса
"""

import os
import sys
import django
from pathlib import Path

def ensure_static_files():
    """Обеспечивает наличие статических файлов Django"""
    
    # Добавляем путь к проекту
    project_root = Path(__file__).parent
    sys.path.insert(0, str(project_root))
    
    # Настраиваем Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'videocall_app.settings')
    
    try:
        django.setup()
        
        from django.conf import settings
        from django.core.management import execute_from_command_line
        
        static_root = Path(settings.STATIC_ROOT)
        
        # Создаем директорию если её нет
        static_root.mkdir(parents=True, exist_ok=True)
        
        # Проверяем, есть ли статические файлы
        admin_css = static_root / 'admin' / 'css' / 'base.css'
        
        if not admin_css.exists():
            print("📦 Static files not found, collecting...")
            
            # Собираем статические файлы
            execute_from_command_line(['manage.py', 'collectstatic', '--noinput', '--clear'])
            
            print("✅ Static files collected successfully")
        else:
            print("✅ Static files already exist")
            
        # Проверяем результат
        if admin_css.exists():
            print(f"✅ Admin CSS found: {admin_css}")
            print(f"📁 Static files directory: {static_root}")
            print(f"📊 Admin CSS files:")
            admin_css_dir = static_root / 'admin' / 'css'
            if admin_css_dir.exists():
                for css_file in sorted(admin_css_dir.glob('*.css')):
                    print(f"   - {css_file.name}")
        else:
            print("❌ Admin CSS still not found after collection")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Error ensuring static files: {e}")
        return False

if __name__ == '__main__':
    success = ensure_static_files()
    sys.exit(0 if success else 1)
