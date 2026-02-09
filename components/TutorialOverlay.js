import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

/**
 * TutorialOverlay
 * 
 * Props:
 * - steps: Array of objects { target: {x, y, w, h}, title, description, position: 'top' | 'bottom' }
 * - visible: boolean
 * - onComplete: function called when tutorial is finished or skipped
 */
export default function TutorialOverlay({ visible, steps = [], onComplete }) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const fadeAnim = new Animated.Value(0);

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            setCurrentStepIndex(0);
        }
    }, [visible]);

    if (!visible || steps.length === 0) return null;

    const currentStep = steps[currentStepIndex];

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            onComplete();
        });
    };

    // Helper to render the "spotlight" hole
    // We'll use a simple Overlay approach: 4 views around the target hole
    const renderSpotlight = (target) => {
        if (!target) return <View style={styles.fullOverlay} />;

        // target = { x, y, w, h } (absolute coordinates)
        // We need to ensure we account for status bar if necessary, but assuming standard full screen overlay

        return (
            <View style={StyleSheet.absoluteFill}>
                {/* Top */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: target.y, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                {/* Bottom */}
                <View style={{ position: 'absolute', top: target.y + target.h, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                {/* Left */}
                <View style={{ position: 'absolute', top: target.y, left: 0, width: target.x, height: target.h, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                {/* Right */}
                <View style={{ position: 'absolute', top: target.y, left: target.x + target.w, right: 0, height: target.h, backgroundColor: 'rgba(0,0,0,0.7)' }} />
            </View>
        );
    };

    return (
        <Modal transparent visible={visible} animationType="fade">
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                {renderSpotlight(currentStep.target)}

                <View style={[
                    styles.tooltipbox,
                    currentStep.position === 'top'
                        ? { top: (currentStep.target?.y || 100) - 150 }
                        : { top: (currentStep.target?.y || 100) + (currentStep.target?.h || 0) + 20 }
                ]}>
                    <Text style={styles.title}>{currentStep.title}</Text>
                    <Text style={styles.desc}>{currentStep.description}</Text>

                    <View style={styles.footer}>
                        <Text style={styles.pager}>{currentStepIndex + 1} / {steps.length}</Text>
                        <TouchableOpacity style={styles.btn} onPress={handleNext}>
                            <Text style={styles.btnText}>{currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={styles.skipBtn} onPress={handleComplete}>
                    <Text style={styles.skipText}>Skip Tutorial</Text>
                </TouchableOpacity>

            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    fullOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
    tooltipbox: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        elevation: 10,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1a1f36' },
    desc: { fontSize: 14, color: '#5e6c84', marginBottom: 16, lineHeight: 20 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pager: { fontSize: 12, color: '#8890a6', fontWeight: '600' },
    btn: { backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    skipBtn: { position: 'absolute', top: 50, right: 20, padding: 10 },
    skipText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
