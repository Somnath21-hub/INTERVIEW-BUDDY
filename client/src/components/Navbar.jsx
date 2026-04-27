import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from "framer-motion"; 
import { BsRobot, BsCoin } from "react-icons/bs";
import { HiOutlineLogout } from "react-icons/hi";
import { FaUserAstronaut } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import { ServerUrl } from '../App';
import { setUserData } from '../redux/userSlice';
import axios from "axios";   
import AuthModel from './AuthModel';

function Navbar() {

    const [showAuth, setShowAuth] = useState(false)

    const { userData } = useSelector((state) => state.user)

    const [showCreditPopup, setShowCreditPopup] = useState(false)
    const [showUserPopup, setShowUserPopup] = useState(false)

    const navigate = useNavigate()
    const dispatch = useDispatch()

    const handleLogout = async (e) => {
        if(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            await axios.get(ServerUrl + "/api/auth/logout", {
                withCredentials: true
            })

            dispatch(setUserData(null))
            setShowCreditPopup(false)
            setShowUserPopup(false)
            setShowAuth(false)

            navigate("/")

        } catch (error) {
            console.log("Logout error:", error)
        }
    }

    return (
        <div className='bg-[#f3f3f3] flex justify-center px-4 pt-6'>
            
            <motion.div 
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className='w-full max-w-6xl bg-white rounded-[24px] shadow-sm border border-gray-200 px-8 py-4 flex justify-between items-center relative'
            >

                {/* LEFT */}
                <div className='flex items-center gap-3 cursor-pointer'>
                    <div className='bg-black text-white p-2 rounded-lg'>
                        <BsRobot size={18} />
                    </div>
                    <h1 className='font-semibold hidden md:block text-lg'>
                        InterviewIQ.AI
                    </h1>
                </div>

                {/* RIGHT */}
                <div className='flex items-center gap-6 relative'>

                    {/* CREDIT */}
                    <div className='relative'>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowCreditPopup(!showCreditPopup)
                                setShowUserPopup(false)
                            }}
                            className='flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-md hover:bg-gray-200 transition'
                        >
                            <BsCoin size={20} />
                            {userData?.credits || 0}
                        </button>

                        {showCreditPopup && (
                            <div className="absolute right-0 mt-3 w-64 bg-white shadow-xl border border-gray-200 rounded-lg p-5 z-50">
                                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                                    Need more credits to continue interviews?
                                </p>

                                <button 
                                    onClick={() => navigate("/pricing")}
                                    className="w-full bg-black text-white py-2 rounded-lg text-sm hover:bg-gray-800 transition"
                                >
                                    Buy More Credits
                                </button>
                            </div>
                        )}
                    </div>

                    {/* USER */}
                    <div className='relative'>
                        <button 
                            onClick={() => {
                                if(!userData){
                                    setShowAuth(true)
                                    return
                                }

                                setShowUserPopup(!showUserPopup)
                                setShowCreditPopup(false)
                            }}
                            className='w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-semibold'
                        >
                            {userData?.name
                                ? userData.name.slice(0, 1).toUpperCase()
                                : <FaUserAstronaut size={16} />
                            }
                        </button>

                        {showUserPopup && (
                            <div className="absolute right-0 mt-3 w-48 bg-white shadow-xl border border-gray-200 rounded-xl p-4">
                                <p className='text-md text-blue-500 font-medium mb-1'>
                                    {userData?.name || "User"}
                                </p>

                                <button 
                                    onClick={() => navigate("/history")} 
                                    className='w-full text-left text-sm py-2 hover:text-black text-gray-600'
                                >
                                    Interview History
                                </button>

                                <button 
                                    onClick={handleLogout} 
                                    className='w-full text-left text-sm py-2 flex items-center gap-2 text-red-500'
                                >
                                    <HiOutlineLogout size={16} />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </motion.div>

            {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}
        </div>
    )
}

export default Navbar