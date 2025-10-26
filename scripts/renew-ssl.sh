#!/bin/bash

# Скрипт для автоматического обновления SSL сертификатов Let's Encrypt

echo "🔄 Начинаем обновление SSL сертификатов..."

# Обновляем сертификаты с помощью certbot
certbot renew --nginx --quiet

if [ $? -eq 0 ]; then
    echo "✅ Сертификаты успешно обновлены."

    # Перезагружаем nginx для применения изменений
    echo "🔄 Перезагружаем nginx..."
    sudo systemctl reload nginx

    if [ $? -eq 0 ]; then
        echo "✅ Nginx перезагружен успешно."
        echo "📊 Статус сертификатов:"
        certbot certificates
    else
        echo "❌ Ошибка при перезагрузке nginx."
        exit 1
    fi
else
    echo "❌ Ошибка при обновлении сертификатов."
    exit 1
fi

echo "🎉 Обновление SSL завершено успешно!"